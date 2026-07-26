import 'server-only';
import PaymentOrder from '@/models/PaymentOrder';
import SystemSetting from '@/models/SystemSetting';
import User from '@/models/User';
import { creditUser } from '@/lib/billing/ledger';
import { activateFromOrder } from '@/lib/billing/subscription-service';
import { quotePlan } from '@/lib/billing/plans';
import { sendSubscriptionActivatedEmail } from '@/lib/email';

// 注意：这里刻意不使用 mongoose.connection.transaction。
// 生产库是单机 mongod，多文档事务会直接抛 IllegalOperation。
// 改为「CAS 抢单 + 单文档原子扣加 + 幂等键账本」，在单机上同样保证 exactly-once，
// 且任意一步崩溃后，微信回调重试或前端轮询补单都能从断点续上。

function creditKey(outTradeNo) {
  // 保持与历史账本一致的键格式，老数据不会因为改造而重复入账。
  return `wechat-payment:${outTradeNo}`;
}

export async function fulfillPaymentOrder({ outTradeNo, transactionId, amountFen, paidAt }) {
  // 1) 抢单。把 crediting 也纳入可抢范围，使中断的入账可以继续推进。
  const claimed = await PaymentOrder.findOneAndUpdate(
    { outTradeNo, status: { $in: ['created', 'paying', 'crediting'] } },
    { $set: { status: 'crediting', providerTransactionId: transactionId, paidAt: paidAt || new Date() } },
    { new: true },
  );
  const order = claimed || await PaymentOrder.findOne({ outTradeNo });
  if (!order) throw new Error('支付订单不存在');
  if (!claimed) {
    if (order.status === 'paid') return { alreadyPaid: true, order };
    if (['refunded', 'partial_refunded', 'refunding'].includes(order.status)) return { alreadyPaid: true, order };
    throw new Error('支付订单状态不可入账');
  }
  if (Number(amountFen) !== order.amountFen) {
    await PaymentOrder.updateOne({ _id: order._id, status: 'crediting' }, { $set: { status: 'failed', errorMessage: '微信支付通知金额与订单不匹配' } });
    throw new Error('微信支付通知金额不匹配');
  }

  // 2) 发放权益。两条路径各自幂等，重放不会重复加钱。
  let balance;
  let subscription = null;
  if (order.purpose === 'subscription') {
    const planSetting = await SystemSetting.findOne({ key: 'plans' }).lean();
    const planSettings = planSetting?.value || {};
    subscription = await activateFromOrder(order, planSettings);
    const user = await User.findById(order.userId).select('balance email');
    balance = user?.balance;
    if (subscription && !order.subscriptionId) {
      await PaymentOrder.updateOne({ _id: order._id }, { $set: { subscriptionId: subscription._id } });
    }
    // 只在这次调用真正推进了订单（claimed）时发信，回调重试不会重复打扰用户。
    const quote = quotePlan(planSettings, order.planId, order.periodMonths);
    if (user?.email && quote) {
      await sendSubscriptionActivatedEmail({
        email: user.email,
        planName: quote.planName,
        periodLabel: quote.periodLabel,
        currentPeriodEnd: subscription.currentPeriodEnd,
        grantCredits: quote.grantCredits,
      });
    }
  } else {
    const result = await creditUser({
      userId: order.userId,
      key: creditKey(order.outTradeNo),
      delta: order.credits,
      type: 'charge',
      description: `微信支付充值 · ¥${(order.amountFen / 100).toFixed(2)}`,
      metadata: { paymentOrderId: order._id, outTradeNo: order.outTradeNo, transactionId },
    });
    balance = result.balance;
  }

  // 3) 收尾。即使这一步失败，重试进来也只会重复走一遍幂等操作。
  await PaymentOrder.updateOne({ _id: order._id, status: 'crediting' }, { $set: { status: 'paid' } });
  return { paid: true, order: await PaymentOrder.findById(order._id), balance, subscription };
}
