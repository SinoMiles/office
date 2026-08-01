import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { SESSION_MAX_AGE_SECONDS, signToken } from '@/lib/auth';
import { consumeRateLimit, normalizePhone, requestIp } from '@/lib/auth-security';
import User from '@/models/User';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    await connectToDatabase();
    const body = await request.json();
    const phone = normalizePhone(body.phone);
    const password = String(body.password || '');
    if (!phone || !password) return NextResponse.json({ error: '请输入手机号和密码' }, { status: 400 });

    const [ipRate, accountRate] = await Promise.all([
      consumeRateLimit({ scope: 'phone-password-ip', identifier: requestIp(request), limit: 30, windowMs: 15 * 60_000 }),
      consumeRateLimit({ scope: 'phone-password-account', identifier: phone, limit: 10, windowMs: 15 * 60_000 }),
    ]);
    if (!ipRate.allowed || !accountRate.allowed) {
      return NextResponse.json({ error: '尝试次数过多，请 15 分钟后再试' }, { status: 429 });
    }

    const user = await User.findOne({ phone });
    const legacyPasswordAccount = user && !String(user.email || '').endsWith('@account.officegpt.invalid');
    if (!user || (!user.phonePasswordEnabledAt && !legacyPasswordAccount) || !await bcrypt.compare(password, user.password)) {
      return NextResponse.json({ error: '手机号或密码错误，请使用短信验证码登录' }, { status: 401 });
    }

    const token = signToken({ id: user._id, role: user.role, version: user.tokenVersion });
    const response = NextResponse.json({
      success: true,
      user: { phone: user.phone, role: user.role, balance: user.balance, membershipLevel: user.membershipLevel || 'FREE' },
    });
    response.cookies.set({
      name: 'auth_token',
      value: token,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    return response;
  } catch (error) {
    console.error('[auth:phone-password] 登录失败', error);
    return NextResponse.json({ error: '登录失败，请稍后重试' }, { status: 500 });
  }
}
