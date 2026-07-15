import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { settleTaskCredits } from '@/lib/billing/service';
import Task from '@/models/Task';

export const runtime = 'nodejs';

function validSignature(body, signature) {
  const secret = process.env.JWT_SECRET;
  if (!secret || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  return expectedBuffer.length === signatureBuffer.length && crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
}

export async function POST(request) {
  const rawBody = await request.text();
  if (!validSignature(rawBody, request.headers.get('x-officeweb-signature'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const payload = JSON.parse(rawBody);
  if (!payload.userId || !payload.conversationId) {
    return NextResponse.json({ error: 'Invalid settlement payload' }, { status: 400 });
  }
  await connectToDatabase();
  const task = await Task.findOne({
    userId: payload.userId,
    aionConversationId: payload.conversationId,
    'billing.state': { $in: ['reserved', 'settling', 'settled', 'released'] },
  }).sort({ createdAt: -1 });
  if (!task) return NextResponse.json({ success: true, skipped: true });
  const result = await settleTaskCredits({ taskId: task._id, userId: payload.userId, usage: payload.usage, source: 'aioncore-ws' });
  return NextResponse.json({ success: true, result });
}
