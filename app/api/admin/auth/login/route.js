import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { ADMIN_SESSION_MAX_AGE_SECONDS, signAdminToken } from '@/lib/auth';
import { consumeRateLimit, normalizeEmail, requestIp } from '@/lib/auth-security';
import User from '@/models/User';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    await connectToDatabase();
    const body = await request.json();
    const email = normalizeEmail(body.email);
    const password = String(body.password || '');
    if (!email || !password) return NextResponse.json({ error: '请输入管理员账号和密码' }, { status: 400 });

    const rate = await consumeRateLimit({
      scope: 'admin-login',
      identifier: `${requestIp(request)}:${email}`,
      limit: 8,
      windowMs: 15 * 60_000,
    });
    if (!rate.allowed) return NextResponse.json({ error: '尝试次数过多，请 15 分钟后再试' }, { status: 429 });

    const admin = await User.findOne({ email, role: 'admin' });
    if (!admin || !await bcrypt.compare(password, admin.password)) {
      return NextResponse.json({ error: '管理员账号或密码错误' }, { status: 401 });
    }

    const response = NextResponse.json({ success: true, user: { email: admin.email, role: admin.role } });
    response.cookies.set({
      name: 'admin_token',
      value: signAdminToken({ id: admin._id, role: 'admin', version: admin.tokenVersion }),
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
    });
    return response;
  } catch (error) {
    console.error('[admin:auth] 登录失败', error);
    return NextResponse.json({ error: '登录失败，请稍后重试' }, { status: 500 });
  }
}
