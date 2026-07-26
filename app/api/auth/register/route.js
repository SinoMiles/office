import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import User from '@/models/User';
import { signToken } from '@/lib/auth';
import BillingRecord from '@/models/BillingRecord';
import { consumeEmailCode, consumeRateLimit, normalizeEmail, requestIp } from '@/lib/auth-security';

export async function POST(req) {
  try {
    await connectToDatabase();
    const body = await req.json();
    const email = normalizeEmail(body.email);
    const password = String(body.password || '');
    const code = String(body.code || '');

    const rate = await consumeRateLimit({ scope: 'register', identifier: requestIp(req), limit: 5, windowMs: 24 * 60 * 60_000 });
    if (!rate.allowed) return NextResponse.json({ error: '该网络今日注册次数已达上限' }, { status: 429 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8 || password.length > 128) {
      return NextResponse.json({ error: '请输入有效邮箱，密码至少 8 位' }, { status: 400 });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json({ error: '邮箱已被注册' }, { status: 400 });
    }
    if (!await consumeEmailCode({ email, purpose: 'register', code })) {
      return NextResponse.json({ error: '邮箱验证码错误或已过期' }, { status: 400 });
    }
    const bonusRate = await consumeRateLimit({ scope: 'signup-credit-ip', identifier: requestIp(req), limit: 1, windowMs: 30 * 24 * 60 * 60_000 });
    const signupBonus = bonusRate.allowed ? 10000 : 0;

    const user = await User.create({
      email,
      password,
      emailVerifiedAt: new Date(),
      balance: signupBonus,
      role: 'user'
    });
    if (signupBonus) {
      await BillingRecord.create({ userId: user._id, type: 'charge', amount: signupBonus, balanceDelta: signupBonus, balanceBefore: 0, balanceAfter: signupBonus, description: '新用户注册赠送', idempotencyKey: `signup:${user._id}` });
    }

    const token = signToken({ id: user._id, role: user.role, version: user.tokenVersion });
    
    const response = NextResponse.json({ success: true, user: { email: user.email, role: user.role, balance: user.balance } });
    
    response.cookies.set({
      name: 'auth_token',
      value: token,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    });

    return response;
  } catch (error) {
    console.error('Registration failed', error);
    return NextResponse.json({ error: '注册失败，请稍后重试' }, { status: 500 });
  }
}
