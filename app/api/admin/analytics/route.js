import { NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import User from '@/models/User';
import Task from '@/models/Task';
import PaymentOrder from '@/models/PaymentOrder';

export const dynamic = 'force-dynamic';

const DAY = 24 * 60 * 60 * 1000;

function chinaDayStart(date = new Date()) {
  const shifted = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - 8 * 60 * 60 * 1000);
}

function dateKey(date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function changeRate(current, previous) {
  if (!previous) return current ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export async function GET(request) {
  const admin = await getCurrentAdmin();
  if (!admin || admin.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  await connectToDatabase();
  const requestedDays = Number(new URL(request.url).searchParams.get('days'));
  const days = [7, 30, 90].includes(requestedDays) ? requestedDays : 30;
  const todayStart = chinaDayStart();
  const tomorrowStart = new Date(todayStart.getTime() + DAY);
  const rangeStart = new Date(todayStart.getTime() - (days - 1) * DAY);
  const previousStart = new Date(rangeStart.getTime() - days * DAY);
  const customerUserIds = await User.distinct('_id', { role: 'user' });

  const [
    newUsers, previousNewUsers, dauUsers, wauUsers,
    totalTasks, periodTasks, previousTasks, completedTasks,
    totalRevenueRows, periodRevenueRows, previousRevenueRows, todayRevenueRows,
    totalPayingUsers, dailyUsers, dailyTasks, dailyActiveUsers, dailyRevenue, paymentOrders,
  ] = await Promise.all([
    User.countDocuments({ role: 'user', createdAt: { $gte: rangeStart, $lt: tomorrowStart } }),
    User.countDocuments({ role: 'user', createdAt: { $gte: previousStart, $lt: rangeStart } }),
    Task.distinct('userId', { createdAt: { $gte: todayStart, $lt: tomorrowStart }, userId: { $in: customerUserIds } }).then((rows) => rows.length),
    Task.distinct('userId', { createdAt: { $gte: new Date(todayStart.getTime() - 6 * DAY), $lt: tomorrowStart }, userId: { $in: customerUserIds } }).then((rows) => rows.length),
    Task.countDocuments({ userId: { $in: customerUserIds } }),
    Task.countDocuments({ userId: { $in: customerUserIds }, createdAt: { $gte: rangeStart, $lt: tomorrowStart } }),
    Task.countDocuments({ userId: { $in: customerUserIds }, createdAt: { $gte: previousStart, $lt: rangeStart } }),
    Task.countDocuments({ userId: { $in: customerUserIds }, createdAt: { $gte: rangeStart, $lt: tomorrowStart }, status: 'completed' }),
    PaymentOrder.aggregate([{ $match: { status: 'paid' } }, { $group: { _id: null, value: { $sum: '$amountFen' } } }]),
    PaymentOrder.aggregate([{ $match: { status: 'paid', paidAt: { $gte: rangeStart, $lt: tomorrowStart } } }, { $group: { _id: null, value: { $sum: '$amountFen' } } }]),
    PaymentOrder.aggregate([{ $match: { status: 'paid', paidAt: { $gte: previousStart, $lt: rangeStart } } }, { $group: { _id: null, value: { $sum: '$amountFen' } } }]),
    PaymentOrder.aggregate([{ $match: { status: 'paid', paidAt: { $gte: todayStart, $lt: tomorrowStart } } }, { $group: { _id: null, value: { $sum: '$amountFen' } } }]),
    PaymentOrder.distinct('userId', { status: 'paid' }).then((rows) => rows.length),
    User.aggregate([{ $match: { role: 'user', createdAt: { $gte: rangeStart, $lt: tomorrowStart } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Shanghai' } }, value: { $sum: 1 } } }]),
    Task.aggregate([{ $match: { userId: { $in: customerUserIds }, createdAt: { $gte: rangeStart, $lt: tomorrowStart } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Shanghai' } }, value: { $sum: 1 } } }]),
    Task.aggregate([{ $match: { createdAt: { $gte: rangeStart, $lt: tomorrowStart }, userId: { $in: customerUserIds } } }, { $group: { _id: { date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Shanghai' } }, userId: '$userId' } } }, { $group: { _id: '$_id.date', value: { $sum: 1 } } }]),
    PaymentOrder.aggregate([{ $match: { status: 'paid', paidAt: { $gte: rangeStart, $lt: tomorrowStart } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$paidAt', timezone: 'Asia/Shanghai' } }, value: { $sum: '$amountFen' } } }]),
    PaymentOrder.find().sort({ createdAt: -1 }).limit(30).populate('userId', 'phone').lean(),
  ]);

  const maps = [dailyUsers, dailyTasks, dailyActiveUsers, dailyRevenue].map((rows) => new Map(rows.map((row) => [row._id, row.value])));
  const daily = Array.from({ length: days }, (_, index) => {
    const date = new Date(rangeStart.getTime() + index * DAY);
    const key = dateKey(date);
    return { date: key, users: maps[0].get(key) || 0, tasks: maps[1].get(key) || 0, activeUsers: maps[2].get(key) || 0, revenue: (maps[3].get(key) || 0) / 100 };
  });

  const periodRevenue = (periodRevenueRows[0]?.value || 0) / 100;
  const previousRevenue = (previousRevenueRows[0]?.value || 0) / 100;
  return NextResponse.json({
    days,
    summary: {
      totalUsers: customerUserIds.length, newUsers, userGrowth: changeRate(newUsers, previousNewUsers), dauUsers, wauUsers,
      totalTasks, periodTasks, taskGrowth: changeRate(periodTasks, previousTasks),
      completionRate: periodTasks ? Math.round((completedTasks / periodTasks) * 1000) / 10 : 0,
      totalRevenue: (totalRevenueRows[0]?.value || 0) / 100,
      periodRevenue, revenueGrowth: changeRate(periodRevenue, previousRevenue),
      todayRevenue: (todayRevenueRows[0]?.value || 0) / 100,
      totalPayingUsers,
    },
    daily,
    payments: paymentOrders.map((order) => ({
      id: String(order._id), outTradeNo: order.outTradeNo, phone: order.userId?.phone || '未知用户',
      amount: order.amountFen / 100, credits: order.credits, status: order.status,
      createdAt: order.createdAt, paidAt: order.paidAt,
    })),
  });
}
