import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import Task from '@/models/Task';
import { getAioncoreBaseUrl } from '@/lib/aioncore/config';
import { releaseTaskReservation, settleTaskCredits } from '@/lib/billing/service';
import { readConversationUsage, subtractUsage } from '@/lib/aioncore/session-usage';
import { aioncoreHeaders } from '@/lib/aioncore/bridge-auth';

const AIONCORE_URL = getAioncoreBaseUrl();

// 无法向 AionCore 确认状态时的兜底时限。超过这个时间仍停留在 processing
// 的任务一律判失败 —— 否则它会被工作台永远渲染成「思考中…」。
const STALE_AFTER_MS = 30 * 60_000;
// 刚创建的任务允许短暂查不到会话（AionCore 正在建会话），不要误杀。
const STARTUP_GRACE_MS = 2 * 60_000;

function ageOf(task) {
  return Date.now() - new Date(task.updatedAt || task.createdAt).getTime();
}

async function failTask(task, userId, reason) {
  await releaseTaskReservation({ taskId: task._id, userId, reason }).catch(() => undefined);
  await Task.updateOne({ _id: task._id }, {
    $set: { status: 'failed', 'runtime.state': 'failed', 'runtime.updatedAt': new Date(), errorMessage: reason },
  });
  return NextResponse.json({ success: true, task: null, recovered: true });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await connectToDatabase();
  const task = await Task.findOne({ userId: user._id, status: { $in: ['processing', 'cancelling'] } }).sort({ updatedAt: -1 });
  if (!task) return NextResponse.json({ success: true, task: null });

  const age = ageOf(task);

  // 任务从未拿到会话 ID —— 通常是创建任务后、AionCore 建会话前进程中断。
  // 以前这里直接跳过全部检查，任务会永久停留在 processing。
  if (!task.aionConversationId) {
    if (age > STARTUP_GRACE_MS) {
      return failTask(task, user._id, '任务未能正常启动，请重新发送');
    }
    return NextResponse.json({ success: true, task: task.toObject() });
  }

  try {
    const response = await fetch(`${AIONCORE_URL}/api/conversations/${encodeURIComponent(task.aionConversationId)}`, {
      headers: aioncoreHeaders(String(user._id)),
      signal: AbortSignal.timeout(5000),
    });

    // 服务已响应但会话不存在：AionCore 重启后丢掉了这次会话，任务不可能再恢复。
    // 这是最常见的僵尸来源，此前被当成「无法确认」而一直保留。
    if (response.status === 404 && age > STARTUP_GRACE_MS) {
      return failTask(task, user._id, '任务会话已丢失（服务重启），请重新发送');
    }

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
      return failTask(task, user._id, '任务未能正常启动，请重新发送');
    }
  } catch {
    // 网络层失败（AionCore 未就绪或超时）时无法判定，交给下面的兜底时限处理。
  }

  // 无法确认状态且已经停滞太久，判失败而不是让它一直「思考中」。
  if (age > STALE_AFTER_MS) {
    return failTask(task, user._id, '任务长时间无响应，已自动结束，请重新发送');
  }
  return NextResponse.json({ success: true, task: task.toObject() });
}
