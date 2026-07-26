import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import BillingRecord from '@/models/BillingRecord';
import Task from '@/models/Task';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    // Fetch total files processed
    const totalFiles = await Task.countDocuments({ userId: user._id });

    // Fetch total consumed tokens
    const consumptionResult = await BillingRecord.aggregate([
      { $match: { userId: user._id, type: 'consume' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalConsumed = consumptionResult[0]?.total || 0;

    // 侧边栏的历史记录按「会话」聚合，而不是按 Task。
    // 每一次追问都会新建一条 Task（同一个 aionConversationId + parentTaskId），
    // 直接平铺的话，一个三轮对话会占三行，而且排在最上面的是最后一句话 ——
    // 看起来就像标题取的是最新发言。这里取每个会话最早的那条：
    // _id 用根 Task 的 id（重命名/置顶/删除都以它为准），标题用首句，
    // 排序则按最近活跃时间，让刚聊过的会话仍然排在前面。
    const recentTasks = await Task.aggregate([
      { $match: { userId: user._id } },
      { $sort: { createdAt: 1 } },
      {
        $group: {
          // 早期数据可能没有 aionConversationId，退化成按自身 id 独立成组
          _id: { $ifNull: ['$aionConversationId', { $toString: '$_id' }] },
          rootId: { $first: '$_id' },
          prompt: { $first: '$prompt' },
          filename: { $first: '$filename' },
          aionConversationId: { $first: '$aionConversationId' },
          workspace: { $first: '$workspace' },
          createdAt: { $first: '$createdAt' },
          isPinned: { $max: '$isPinned' },
          lastActiveAt: { $max: '$updatedAt' },
          turns: { $sum: 1 },
        },
      },
      { $sort: { isPinned: -1, lastActiveAt: -1 } },
      { $limit: 50 },
      {
        $project: {
          _id: '$rootId',
          prompt: 1,
          filename: 1,
          aionConversationId: 1,
          workspace: 1,
          createdAt: 1,
          isPinned: 1,
          lastActiveAt: 1,
          turns: 1,
        },
      },
    ]);

    return NextResponse.json({ 
      success: true, 
      user: {
        username: user.username,
        email: user.email,
        // 前端靠这两个字段决定要不要挂绑定提示、要不要拦下发送
        phone: user.phone || '',
        phoneVerified: Boolean(user.phoneVerifiedAt),
        role: user.role
      },
      stats: {
        totalFiles,
        totalConsumed: totalConsumed.toFixed(2),
        savedTimeHours: (totalFiles * 0.5).toFixed(1), // Assuming 30 mins saved per file
        recentTasks
      }
    });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
