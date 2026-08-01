import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { consumeRateLimit, requestIp } from '@/lib/auth-security';
import User from '@/models/User';

export const runtime = 'nodejs';

export async function POST(request) {
  await connectToDatabase();
  const current = await getCurrentUser();
  if (!current?.phoneVerifiedAt) return NextResponse.json({ error: '请先使用手机号登录' }, { status: 401 });

  const rate = await consumeRateLimit({
    scope: 'phone-password-set',
    identifier: `${current._id}:${requestIp(request)}`,
    limit: 10,
    windowMs: 60 * 60_000,
  });
  if (!rate.allowed) return NextResponse.json({ error: '操作过于频繁，请稍后再试' }, { status: 429 });

  const { password } = await request.json();
  const normalized = String(password || '');
  if (normalized.length < 8 || normalized.length > 128) {
    return NextResponse.json({ error: '密码长度需要为 8–128 位' }, { status: 400 });
  }
  const passwordHash = await bcrypt.hash(normalized, 10);
  await User.updateOne(
    { _id: current._id },
    { $set: { password: passwordHash, phonePasswordEnabledAt: new Date() } },
  );
  return NextResponse.json({ success: true });
}
