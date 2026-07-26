import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { readConversationUsage, subtractUsage } from '@/lib/aioncore/session-usage';
import { releaseTaskReservation, settleTaskCredits } from '@/lib/billing/service';
import BillingRecord from '@/models/BillingRecord';
import Task from '@/models/Task';

function authorized(body, signature) {
  const expected = crypto.createHmac('sha256', process.env.JWT_SECRET).update(body).digest('hex');
  const left = Buffer.from(expected);
  const right = Buffer.from(signature || '');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export async function POST(request) {
  const body = await request.text();
  if (!authorized(body, request.headers.get('x-officeweb-signature'))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await connectToDatabase();
  const staleSettling = await Task.find({ 'billing.state': 'settling', updatedAt: { $lt: new Date(Date.now() - 10 * 60_000) } }).limit(100);
  for (const task of staleSettling) {
    const ledger = await BillingRecord.findOne({ idempotencyKey: `task:${task._id}:settle` }).lean();
    if (ledger) {
      await Task.updateOne({ _id: task._id, 'billing.state': 'settling' }, { $set: { 'billing.state': 'settled', 'billing.settledAt': ledger.createdAt, 'billing.chargedCredits': ledger.amount, 'billing.usage': ledger.metadata?.usage, tokensUsed: ledger.metadata?.usage?.totalTokens || 0, cost: ledger.amount } });
    } else {
      await Task.updateOne({ _id: task._id, 'billing.state': 'settling' }, { $set: { 'billing.state': 'reserved' } });
    }
  }
  // 僵尸任务清扫：AionCore 重启会丢掉会话，任务却永远停在 processing，
  // 工作台每次加载都会把它渲染成「思考中…」。这里做时间兜底，
  // 免得用户不打开工作台就永远清不掉。
  const zombies = await Task.find({
    status: { $in: ['processing', 'cancelling'] },
    updatedAt: { $lt: new Date(Date.now() - 60 * 60_000) },
  }).limit(100);
  for (const zombie of zombies) {
    await releaseTaskReservation({ taskId: zombie._id, userId: zombie.userId, reason: '任务长时间无响应，已自动结束' }).catch(() => undefined);
    await Task.updateOne({ _id: zombie._id, status: { $in: ['processing', 'cancelling'] } }, {
      $set: { status: 'failed', 'runtime.state': 'failed', 'runtime.updatedAt': new Date(), errorMessage: '任务长时间无响应，已自动结束，请重新发送' },
    });
  }

  const tasks = await Task.find({
    'billing.state': 'reserved',
    aionConversationId: { $exists: true, $ne: '' },
    $or: [{ status: { $in: ['completed', 'failed', 'cancelled'] } }, { updatedAt: { $lt: new Date(Date.now() - 5 * 60_000) } }],
  }).sort({ updatedAt: 1 }).limit(100);
  const results = [];
  for (const task of tasks) {
    try {
      const [totalUsage, settledTasks] = await Promise.all([
        readConversationUsage(task.aionConversationId),
        Task.find({ _id: { $ne: task._id }, userId: task.userId, aionConversationId: task.aionConversationId, 'billing.state': 'settled' }).select('billing.usage').lean(),
      ]);
      const usage = subtractUsage(totalUsage, settledTasks);
      const tokens = Number(usage?.input_tokens || 0) + Number(usage?.output_tokens || 0);
      if (tokens > 0) {
        await settleTaskCredits({ taskId: task._id, userId: task.userId, usage, source: 'billing-reconciler' });
        results.push({ taskId: String(task._id), action: 'settled' });
      } else if (['failed', 'cancelled'].includes(task.status)) {
        await releaseTaskReservation({ taskId: task._id, userId: task.userId, reason: '任务未产生可计费用量' });
        results.push({ taskId: String(task._id), action: 'released' });
      } else {
        results.push({ taskId: String(task._id), action: 'waiting_for_usage' });
      }
    } catch (error) {
      results.push({ taskId: String(task._id), action: 'error', error: error.message });
    }
  }
  return NextResponse.json({ success: true, scanned: tasks.length, zombiesCleared: zombies.length, results });
}
