import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { consumeRateLimit, normalizePhone, phoneCodeHash, requestIp, verifyCaptcha } from '@/lib/auth-security';
import { sendSmsCode } from '@/lib/sms';
import PhoneVerification from '@/models/PhoneVerification';

export const runtime = 'nodejs';

export async function POST(request) {
  await connectToDatabase();
  const { phone, captchaId, captchaAnswer } = await request.json();
  const normalized = normalizePhone(phone);
  if (!normalized) return NextResponse.json({ error: '请输入有效的中国大陆手机号' }, { status: 400 });
  if (!await verifyCaptcha(captchaId, captchaAnswer)) {
    return NextResponse.json({ error: '图形验证码错误或已过期' }, { status: 400 });
  }

  const rates = await Promise.all([
    consumeRateLimit({ scope: 'sms-code-ip', identifier: requestIp(request), limit: 10, windowMs: 60 * 60_000 }),
    consumeRateLimit({ scope: 'sms-code-phone', identifier: normalized, limit: 5, windowMs: 60 * 60_000 }),
  ]);
  if (rates.some((rate) => !rate.allowed)) {
    return NextResponse.json({ error: '验证码发送过于频繁，请稍后再试' }, { status: 429 });
  }

  const code = crypto.randomInt(100000, 1000000).toString();
  await PhoneVerification.create({
    phone: normalized,
    purpose: 'login',
    codeHash: phoneCodeHash(normalized, 'login', code),
    expiresAt: new Date(Date.now() + 10 * 60_000),
  });
  await sendSmsCode({ phone: normalized, code });
  return NextResponse.json({ success: true });
}
