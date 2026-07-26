import 'server-only';
import Subscription from '@/models/Subscription';
import User from '@/models/User';
import { creditUser } from '@/lib/billing/ledger';
import { nextPeriodEnd, quotePlan } from '@/lib/billing/plans';
import { REMINDER_MILESTONES, reminderMilestoneFor } from '@/lib/billing/reminder-schedule';

function sameId(left, right) {
  return String(left) === String(right);
}

/**
 * 订单支付成功后激活或续订会员。对同一笔订单重复调用是安全的。
 *
 * 续订策略：新周期一律接在 currentPeriodEnd 之后顺延，即使用户中途换了档位 ——
 * 这样用户已付费的时间永远不会被吞掉，换档只影响后续的权益等级。
 */
export async function activateFromOrder(order, planSettings) {
  const quote = quotePlan(planSettings, order.planId, order.periodMonths);
  if (!quote) throw new Error(`订阅套餐 ${order.planId} 已下架，无法激活`);
  const now = new Date();

  let subscription = await Subscription.findOne({ userId: order.userId, status: 'active' });
  if (!subscription) {
    try {
      subscription = await Subscription.create({
        userId: order.userId,
        planId: quote.planId,
        membershipLevel: quote.membershipLevel,
        status: 'active',
        autoRenew: true,
        renewMethod: 'manual',
        periodMonths: quote.periodMonths,
        periodCount: 1,
        currentPeriodStart: now,
        currentPeriodEnd: nextPeriodEnd(null, quote.periodMonths, now),
        monthlyCredits: quote.monthlyCredits,
        pricingSnapshot: quote,
        lastOrderId: order._id,
        appliedOrders: [order._id],
        remindersSent: [],
      });
    } catch (error) {
      // 并发下两笔订单同时激活，唯一索引会拦掉后到的那笔，退化成续订路径。
      if (error?.code !== 11000) throw error;
      subscription = await Subscription.findOne({ userId: order.userId, status: 'active' });
    }
  }
  if (!subscription) throw new Error('订阅激活失败：找不到可用的订阅记录');

  if (!subscription.appliedOrders.some((id) => sameId(id, order._id))) {
    const renewed = await Subscription.findOneAndUpdate(
      { _id: subscription._id, appliedOrders: { $ne: order._id } },
      {
        $inc: { periodCount: 1 },
        $set: {
          planId: quote.planId,
          membershipLevel: quote.membershipLevel,
          periodMonths: quote.periodMonths,
          monthlyCredits: quote.monthlyCredits,
          currentPeriodStart: now,
          currentPeriodEnd: nextPeriodEnd(subscription.currentPeriodEnd, quote.periodMonths, now),
          pricingSnapshot: quote,
          lastOrderId: order._id,
          autoRenew: true,
          remindersSent: [],
        },
        $addToSet: { appliedOrders: order._id },
      },
      { new: true },
    );
    subscription = renewed || await Subscription.findById(subscription._id);
  }

  // 赠送额度按周期序号做幂等，重放不会重复发放。
  if (quote.grantCredits > 0) {
    await creditUser({
      userId: order.userId,
      key: `subscription:${subscription._id}:period:${subscription.periodCount}`,
      delta: quote.grantCredits,
      type: 'charge',
      description: `${quote.planName} · ${quote.periodLabel}赠送额度`,
      metadata: { source: 'subscription', planId: quote.planId, periodMonths: quote.periodMonths, periodCount: subscription.periodCount, outTradeNo: order.outTradeNo, subscriptionId: subscription._id },
    });
  }

  await User.updateOne({ _id: order.userId }, { $set: { membershipLevel: subscription.membershipLevel } });
  return subscription;
}

/**
 * 退款后撤销订阅：回滚到上一个周期。若已无剩余周期则直接失效并降级。
 */
export async function revokeForOrder(order) {
  const subscription = await Subscription.findOne({ userId: order.userId, appliedOrders: order._id });
  if (!subscription) return null;
  const remaining = subscription.periodCount - 1;
  if (remaining <= 0) {
    await Subscription.updateOne({ _id: subscription._id }, { $set: { status: 'refunded', expiredAt: new Date(), autoRenew: false } });
    await User.updateOne({ _id: order.userId, membershipLevel: subscription.membershipLevel }, { $set: { membershipLevel: 'FREE' } });
    return Subscription.findById(subscription._id);
  }
  // 还有更早的付费周期，把本次购买的时长退回去，会员继续有效。
  const rolledBackEnd = new Date(subscription.currentPeriodEnd);
  rolledBackEnd.setMonth(rolledBackEnd.getMonth() - subscription.periodMonths);
  const stillValid = rolledBackEnd.getTime() > Date.now();
  await Subscription.updateOne({ _id: subscription._id }, {
    $inc: { periodCount: -1 },
    $set: { currentPeriodEnd: rolledBackEnd, status: stillValid ? 'active' : 'expired', ...(stillValid ? {} : { expiredAt: new Date() }) },
    $pull: { appliedOrders: order._id },
  });
  if (!stillValid) {
    await User.updateOne({ _id: order.userId, membershipLevel: subscription.membershipLevel }, { $set: { membershipLevel: 'FREE' } });
  }
  return Subscription.findById(subscription._id);
}

/**
 * 用户关闭续订：会员权益保留到当前周期结束，只是不再收到续费提醒。
 */
export async function cancelAutoRenew(userId) {
  return Subscription.findOneAndUpdate(
    { userId, status: 'active' },
    { $set: { autoRenew: false, cancelledAt: new Date() } },
    { new: true },
  );
}

export async function resumeAutoRenew(userId) {
  return Subscription.findOneAndUpdate(
    { userId, status: 'active' },
    { $set: { autoRenew: true }, $unset: { cancelledAt: '' } },
    { new: true },
  );
}

/**
 * 到期降级。只在用户当前等级仍等于订阅等级时才降级，
 * 避免把管理员手工赋予的更高等级误伤掉。
 */
export async function expireDueSubscriptions({ now = new Date(), limit = 200 } = {}) {
  const due = await Subscription.find({ status: 'active', currentPeriodEnd: { $lte: now } }).limit(limit);
  const expired = [];
  for (const subscription of due) {
    const claimed = await Subscription.findOneAndUpdate(
      { _id: subscription._id, status: 'active' },
      { $set: { status: 'expired', expiredAt: now } },
      { new: true },
    );
    if (!claimed) continue;
    await User.updateOne({ _id: subscription.userId, membershipLevel: subscription.membershipLevel }, { $set: { membershipLevel: 'FREE' } });
    expired.push(claimed);
  }
  return expired;
}

/**
 * 取出需要发送到期提醒的订阅，并原子地标记里程碑，保证同一周期同一里程碑只发一次。
 * 返回 [{ subscription, milestone }]，实际发信交给调用方。
 */
export async function claimDueReminders({ now = new Date(), limit = 200 } = {}) {
  const horizon = new Date(now.getTime() + Math.max(...REMINDER_MILESTONES) * 86_400_000);
  const candidates = await Subscription.find({
    status: 'active',
    autoRenew: true,
    currentPeriodEnd: { $gt: now, $lte: horizon },
  }).limit(limit).populate('userId', 'email membershipLevel');
  const claims = [];
  for (const subscription of candidates) {
    const daysLeft = Math.ceil((subscription.currentPeriodEnd.getTime() - now.getTime()) / 86_400_000);
    const milestone = reminderMilestoneFor(daysLeft);
    if (!milestone || subscription.remindersSent.includes(milestone)) continue;
    const claimed = await Subscription.findOneAndUpdate(
      { _id: subscription._id, status: 'active', remindersSent: { $ne: milestone } },
      { $addToSet: { remindersSent: milestone } },
      { new: true },
    );
    if (!claimed) continue;
    claims.push({ subscription, milestone, daysLeft });
  }
  return claims;
}

export { REMINDER_MILESTONES };
