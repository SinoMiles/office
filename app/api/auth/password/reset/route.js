import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { consumeEmailCode, consumeRateLimit, normalizeEmail, requestIp } from '@/lib/auth-security';
import User from '@/models/User';

export async function POST(request) {
  await connectToDatabase();
  const body = await request.json();
  const email = normalizeEmail(body.email);
  const password = String(body.password || '');
  if (password.length < 8 || password.length > 128) return NextResponse.json({ error: '密码至少需要 8 位' }, { status: 400 });
  const rate = await consumeRateLimit({ scope: 'password-reset', identifier: requestIp(request), limit: 10, windowMs: 60 * 60_000 });
  if (!rate.allowed) return NextResponse.json({ error: '请求过于频繁，请稍后再试' }, { status: 429 });
  if (!await consumeEmailCode({ email, purpose: 'reset-password', code: body.code })) {
    return NextResponse.json({ error: '邮箱验证码错误或已过期' }, { status: 400 });
  }
  const user = await User.findOne({ email });
  if (!user) return NextResponse.json({ success: true });
  user.password = password;
  user.tokenVersion = Number(user.tokenVersion || 0) + 1;
  await user.save();
  return NextResponse.json({ success: true });
}
