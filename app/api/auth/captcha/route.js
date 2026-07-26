import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { consumeRateLimit, createCaptcha, requestIp } from '@/lib/auth-security';

export async function GET(request) {
  await connectToDatabase();
  const rate = await consumeRateLimit({ scope: 'captcha', identifier: requestIp(request), limit: 30, windowMs: 10 * 60_000 });
  if (!rate.allowed) return NextResponse.json({ error: '请求过于频繁，请稍后再试' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } });
  return NextResponse.json(await createCaptcha(), { headers: { 'Cache-Control': 'no-store' } });
}
