import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import User from '@/models/User';
import bcrypt from 'bcryptjs';
import { signToken } from '@/lib/auth';
import { consumeRateLimit, normalizeEmail, requestIp } from '@/lib/auth-security';

export async function POST(req) {
  try {
    await connectToDatabase();
    const body = await req.json();
    const email = normalizeEmail(body.email);
    const password = String(body.password || '');

    if (!email || !password) {
      return NextResponse.json({ error: '请提供邮箱和密码' }, { status: 400 });
    }
    const [ipRate, accountRate] = await Promise.all([
      consumeRateLimit({ scope: 'login-ip', identifier: requestIp(req), limit: 30, windowMs: 15 * 60_000 }),
      consumeRateLimit({ scope: 'login-account', identifier: email, limit: 10, windowMs: 15 * 60_000 }),
    ]);
    if (!ipRate.allowed || !accountRate.allowed) {
      return NextResponse.json({ error: '尝试次数过多，请 15 分钟后再试' }, { status: 429, headers: { 'Retry-After': String(Math.max(ipRate.retryAfter, accountRate.retryAfter)) } });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return NextResponse.json({ error: '邮箱或密码错误' }, { status: 401 });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return NextResponse.json({ error: '邮箱或密码错误' }, { status: 401 });
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
    console.error('Login failed', error);
    return NextResponse.json({ error: '登录失败，请稍后重试' }, { status: 500 });
  }
}
