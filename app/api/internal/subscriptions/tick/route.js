import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { claimDueReminders, expireDueSubscriptions } from '@/lib/billing/subscription-service';
import { syncPendingRefunds } from '@/lib/billing/refund-service';
import { sendSubscriptionExpiredEmail, sendSubscriptionReminderEmail } from '@/lib/email';
import PaymentOrder from '@/models/PaymentOrder';
import SystemSetting from '@/models/SystemSetting';
import User from '@/models/User';
import { getPlan } from '@/lib/billing/plans';

export const runtime = 'nodejs';

function authorized(body, signature) {
  const expected = crypto.createHmac('sha256', process.env.JWT_SECRET).update(body).digest('hex');
  const left = Buffer.from(expected);
  const right = Buffer.from(signature || '');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

async function planName(planSettings, planId, fallbackLevel) {
  return getPlan(planSettings, planId)?.name || (fallbackLevel === 'ENTERPRISE' ? '企业版' : '专业版');
}

export async function POST(request) {
  const body = await request.text();
  if (!authorized(body, request.headers.get('x-officeweb-signature'))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await connectToDatabase();
  const planSetting = await SystemSetting.findOne({ key: 'plans' }).lean();
  const planSettings = planSetting?.value || {};

  // 1) 到期降级 + 通知
  const expired = await expireDueSubscriptions();
  for (const subscription of expired) {
    const user = await User.findById(subscription.userId).select('email').lean();
    if (!user?.email) continue;
    await sendSubscriptionExpiredEmail({ email: user.email, planName: await planName(planSettings, subscription.planId, subscription.membershipLevel) });
  }

  // 2) T-7 / T-3 / T-1 续费提醒。里程碑在 claim 时已原子标记，这里只负责发信。
  const reminders = await claimDueReminders();
  for (const { subscription, milestone, daysLeft } of reminders) {
    const email = subscription.userId?.email;
    if (!email) continue;
    await sendSubscriptionReminderEmail({
      email,
      planName: await planName(planSettings, subscription.planId, subscription.membershipLevel),
      daysLeft: Math.max(1, Math.min(milestone, daysLeft)),
      currentPeriodEnd: subscription.currentPeriodEnd,
    });
  }

  // 3) 关闭已过期的未支付订单，避免二维码列表越积越多
  const closed = await PaymentOrder.updateMany(
    { status: { $in: ['created', 'paying'] }, expiresAt: { $lt: new Date() } },
    { $set: { status: 'closed', errorMessage: '支付二维码已过期' } },
  );

  // 4) 兜底对账：回调可能丢失，主动向微信确认处理中的退款
  const refunds = await syncPendingRefunds();

  return NextResponse.json({
    success: true,
    expired: expired.length,
    reminded: reminders.length,
    closedOrders: closed.modifiedCount || 0,
    refundsChecked: refunds.length,
  });
}
