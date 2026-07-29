import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import BillingRecord from '@/models/BillingRecord';
import Task from '@/models/Task';

function shanghaiDateKey(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function artifactCategory(filename) {
  const extension = String(filename || '').toLowerCase().match(/\.([^.]+)$/)?.[1] || '';
  if (['xlsx', 'xls', 'csv'].includes(extension)) return 'excel';
  if (['docx', 'doc'].includes(extension)) return 'word';
  if (['pptx', 'ppt'].includes(extension)) return 'ppt';
  if (extension === 'pdf') return 'pdf';
  if (extension === 'md') return 'markdown';
  return 'other';
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setHours(0, 0, 0, 0);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [
      totalFiles,
      statusRows,
      conversationRows,
      consumptionResult,
      tokenRows,
      dailyRows,
      creditDailyRows,
      monthlyTaskRows,
      monthlyCreditRows,
      durationRows,
      artifactRows,
    ] = await Promise.all([
      Task.countDocuments({ userId: user._id }),
      Task.aggregate([
        { $match: { userId: user._id } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Task.aggregate([
        { $match: { userId: user._id } },
        { $group: { _id: { $ifNull: ['$aionConversationId', { $toString: '$_id' }] } } },
        { $count: 'count' },
      ]),
      BillingRecord.aggregate([
        { $match: { userId: user._id, type: 'consume' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Task.aggregate([
        { $match: { userId: user._id } },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$billing.usage.totalTokens', '$tokensUsed'] } } } },
      ]),
      Task.aggregate([
        { $match: { userId: user._id, createdAt: { $gte: sevenDaysAgo } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Shanghai' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      BillingRecord.aggregate([
        { $match: { userId: user._id, type: 'consume', createdAt: { $gte: sevenDaysAgo } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Shanghai' } }, credits: { $sum: '$amount' } } },
        { $sort: { _id: 1 } },
      ]),
      Task.aggregate([
        { $match: { userId: user._id, createdAt: { $gte: previousMonthStart } } },
        { $group: { _id: { $cond: [{ $gte: ['$createdAt', currentMonthStart] }, 'current', 'previous'] }, count: { $sum: 1 } } },
      ]),
      BillingRecord.aggregate([
        { $match: { userId: user._id, type: 'consume', createdAt: { $gte: previousMonthStart } } },
        { $group: { _id: { $cond: [{ $gte: ['$createdAt', currentMonthStart] }, 'current', 'previous'] }, credits: { $sum: '$amount' } } },
      ]),
      Task.aggregate([
        { $match: { userId: user._id, status: 'completed' } },
        { $project: { durationMs: { $subtract: [{ $ifNull: ['$runtime.updatedAt', '$updatedAt'] }, '$createdAt'] } } },
        { $match: { durationMs: { $gte: 0, $lte: 21_600_000 } } },
        { $group: { _id: null, averageMs: { $avg: '$durationMs' } } },
      ]),
      Task.aggregate([
        { $match: { userId: user._id } },
        {
          $project: {
            filenames: {
              $concatArrays: [
                { $map: { input: { $ifNull: ['$artifacts', []] }, as: 'artifact', in: '$$artifact.filename' } },
                ['$outputFilename'],
              ],
            },
          },
        },
        { $unwind: '$filenames' },
        { $match: { filenames: { $type: 'string', $ne: '' } } },
        { $group: { _id: '$filenames', count: { $sum: 1 } } },
      ]),
    ]);
    const totalConsumed = consumptionResult[0]?.total || 0;
    const statusCounts = Object.fromEntries(statusRows.map((item) => [item._id || 'pending', item.count]));
    const finishedTasks = (statusCounts.completed || 0) + (statusCounts.failed || 0) + (statusCounts.cancelled || 0);
    const dailyCounts = new Map(dailyRows.map((item) => [item._id, item.count]));
    const creditDailyCounts = new Map(creditDailyRows.map((item) => [item._id, item.credits]));
    const dailyActivity = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(sevenDaysAgo);
      date.setDate(sevenDaysAgo.getDate() + index);
      const dateKey = shanghaiDateKey(date);
      return { date: dateKey, count: dailyCounts.get(dateKey) || 0, credits: creditDailyCounts.get(dateKey) || 0 };
    });
    const monthlyTasks = Object.fromEntries(monthlyTaskRows.map((item) => [item._id, item.count]));
    const monthlyCredits = Object.fromEntries(monthlyCreditRows.map((item) => [item._id, item.credits]));
    const artifactTypes = { excel: 0, word: 0, ppt: 0, pdf: 0, markdown: 0, other: 0 };
    for (const item of artifactRows) artifactTypes[artifactCategory(item._id)] += item.count;

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
        role: user.role,
        membershipLevel: user.membershipLevel || 'FREE',
      },
      stats: {
        totalFiles,
        totalConversations: conversationRows[0]?.count || 0,
        totalConsumed: totalConsumed.toFixed(2),
        totalTokens: tokenRows[0]?.total || 0,
        savedTimeHours: (totalFiles * 0.5).toFixed(1), // Assuming 30 mins saved per file
        completionRate: finishedTasks ? Math.round(((statusCounts.completed || 0) / finishedTasks) * 100) : 0,
        statusCounts,
        dailyActivity,
        artifactTypes,
        averageTaskSeconds: Math.max(0, Math.round((durationRows[0]?.averageMs || 0) / 1000)),
        currentMonthTasks: monthlyTasks.current || 0,
        previousMonthTasks: monthlyTasks.previous || 0,
        currentMonthCredits: monthlyCredits.current || 0,
        previousMonthCredits: monthlyCredits.previous || 0,
        recentTasks
      }
    });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
