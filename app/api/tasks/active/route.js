import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import Task from '@/models/Task';
import { getAioncoreBaseUrl } from '@/lib/aioncore/config';
import { releaseTaskReservation, settleTaskCredits } from '@/lib/billing/service';
import { readConversationUsage, subtractUsage } from '@/lib/aioncore/session-usage';

const AIONCORE_URL = getAioncoreBaseUrl();

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await connectToDatabase();
  const task = await Task.findOne({ userId: user._id, status: { $in: ['processing', 'cancelling'] } }).sort({ updatedAt: -1 });
  if (!task) return NextResponse.json({ success: true, task: null });

  if (task.aionConversationId) {
    try {
      const response = await fetch(`${AIONCORE_URL}/api/conversations/${encodeURIComponent(task.aionConversationId)}`, {
        signal: AbortSignal.timeout(5000),
      });
      const payload = response.ok ? await response.json() : null;
      const runtime = payload?.data?.runtime;
      if (runtime && runtime.is_processing === false && runtime.can_send_message !== false) {
        if (runtime.task_status === 'finished') {
          if (task.billing?.state === 'reserved') {
            const [totalUsage, settledTasks] = await Promise.all([
              readConversationUsage(task.aionConversationId),
              Task.find({
                _id: { $ne: task._id },
                userId: user._id,
                aionConversationId: task.aionConversationId,
                'billing.state': 'settled',
              }).select('billing.usage').lean(),
            ]);
            const usage = subtractUsage(totalUsage, settledTasks);
            if (usage && usage.input_tokens + usage.output_tokens > 0) {
              await settleTaskCredits({ taskId: task._id, userId: user._id, usage, source: 'active-task-recovery' });
            }
          }
          await Task.updateOne({ _id: task._id }, {
            $set: { status: 'completed', 'runtime.state': 'completed', 'runtime.updatedAt': new Date() },
          });
          return NextResponse.json({ success: true, task: null, recovered: true });
        }
        await releaseTaskReservation({ taskId: task._id, userId: user._id, reason: '任务未能启动，释放预授权状态' });
        await Task.updateOne({ _id: task._id }, {
          $set: {
            status: 'failed',
            'runtime.state': 'failed',
            errorMessage: '任务未能正常启动，请重新发送',
          },
        });
        return NextResponse.json({ success: true, task: null, recovered: true });
      }
    } catch {
      // Preserve the task when runtime state cannot be verified.
    }
  }
  return NextResponse.json({ success: true, task: task.toObject() });
}
