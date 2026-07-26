import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { consumeRateLimit, normalizePhone, phoneCodeHash, requestIp, verifyCaptcha } from '@/lib/auth-security';
import { sendSmsCode } from '@/lib/sms';
import PhoneVerification from '@/models/PhoneVerification';
import User from '@/models/User';

export const runtime = 'nodejs';

export async function POST(request) {
  await connectToDatabase();
  // 绑定只对已登录用户开放，否则这个接口就成了一个免费的短信轰炸入口。
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });
  if (user.phoneVerifiedAt) return NextResponse.json({ error: '账号已绑定手机号' }, { status: 409 });

  const { phone, captchaId, captchaAnswer } = await request.json();
  const normalized = normalizePhone(phone);
  if (!normalized) return NextResponse.json({ error: '请输入有效的中国大陆手机号' }, { status: 400 });
  if (!await verifyCaptcha(captchaId, captchaAnswer)) {
    return NextResponse.json({ error: '图形验证码错误或已过期' }, { status: 400 });
  }

  // 三道限流各挡一种滥用：同一出口 IP 刷量、同一号码被反复骚扰、
  // 同一账号拿不同号码试探哪些已被占用。
  const [ipRate, phoneRate, userRate] = await Promise.all([
    consumeRateLimit({ scope: 'sms-code-ip', identifier: requestIp(request), limit: 10, windowMs: 60 * 60_000 }),
    consumeRateLimit({ scope: 'sms-code-phone', identifier: normalized, limit: 5, windowMs: 60 * 60_000 }),
    consumeRateLimit({ scope: 'sms-code-user', identifier: String(user._id), limit: 8, windowMs: 60 * 60_000 }),
  ]);
  if (!ipRate.allowed || !phoneRate.allowed || !userRate.allowed) {
    return NextResponse.json({ error: '验证码发送过于频繁，请稍后再试' }, { status: 429 });
  }

  const taken = await User.findOne({ phone: normalized }).select('_id').lean();
  if (taken) return NextResponse.json({ error: '该手机号已被其他账号绑定' }, { status: 409 });

  const code = crypto.randomInt(100000, 1000000).toString();
  await PhoneVerification.create({
    phone: normalized,
    purpose: 'bind',
    codeHash: phoneCodeHash(normalized, 'bind', code),
    expiresAt: new Date(Date.now() + 10 * 60_000),
  });
  await sendSmsCode({ phone: normalized, code });
  return NextResponse.json({ success: true });
}
