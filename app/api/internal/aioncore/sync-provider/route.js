import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { syncLlmProviderFromSettings } from '@/lib/aioncore/provider-sync';

export const runtime = 'nodejs';

function authorized(body, signature) {
  const expected = crypto.createHmac('sha256', process.env.JWT_SECRET).update(body).digest('hex');
  const left = Buffer.from(expected);
  const right = Buffer.from(signature || '');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

// 由 server.mjs 在 AionCore 启动后调用，把 Mongo 里的 LLM 配置重新推给 AionCore。
// AionCore 的 provider 存在它自己的 SQLite 里，重建 storage 就会丢，
// 而此前只有管理员手动保存设置才会同步 —— 于是重新部署后聊天会静默失效。
export async function POST(request) {
  const body = await request.text();
  if (!authorized(body, request.headers.get('x-officeweb-signature'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await connectToDatabase();
  const result = await syncLlmProviderFromSettings();
  return NextResponse.json({ success: true, ...result });
}
