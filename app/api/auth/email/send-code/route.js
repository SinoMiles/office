import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { consumeRateLimit, normalizeEmail, requestIp, verificationCodeHash, verifyCaptcha } from '@/lib/auth-security';
import { sendVerificationEmail } from '@/lib/email';
import EmailVerification from '@/models/EmailVerification';
import User from '@/models/User';

export async function POST(request) {
  await connectToDatabase();
  const { email, purpose, captchaId, captchaAnswer } = await request.json();
  const normalized = normalizeEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || !['register', 'reset-password'].includes(purpose)) {
    return NextResponse.json({ error: '请求参数无效' }, { status: 400 });
  }
  if (!await verifyCaptcha(captchaId, captchaAnswer)) return NextResponse.json({ error: '图形验证码错误或已过期' }, { status: 400 });
  const [ipRate, emailRate] = await Promise.all([
    consumeRateLimit({ scope: 'email-code-ip', identifier: requestIp(request), limit: 10, windowMs: 60 * 60_000 }),
    consumeRateLimit({ scope: 'email-code-address', identifier: normalized, limit: 5, windowMs: 60 * 60_000 }),
  ]);
  if (!ipRate.allowed || !emailRate.allowed) return NextResponse.json({ error: '验证码发送过于频繁，请稍后再试' }, { status: 429 });
  const user = await User.findOne({ email: normalized }).select('_id').lean();
  if (purpose === 'register' && user) return NextResponse.json({ error: '该邮箱已注册' }, { status: 409 });
  if (purpose === 'reset-password' && !user) return NextResponse.json({ success: true });
  const code = crypto.randomInt(100000, 1000000).toString();
  await EmailVerification.create({ email: normalized, purpose, codeHash: verificationCodeHash(normalized, purpose, code), expiresAt: new Date(Date.now() + 10 * 60_000) });
  await sendVerificationEmail({ email: normalized, code, purpose });
  return NextResponse.json({ success: true });
}
