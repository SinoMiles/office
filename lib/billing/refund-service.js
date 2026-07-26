import 'server-only';
import crypto from 'node:crypto';
import PaymentOrder from '@/models/PaymentOrder';
import RefundRecord from '@/models/RefundRecord';
import User from '@/models/User';
import { creditUser, roundCredits } from '@/lib/billing/ledger';
import { revokeForOrder } from '@/lib/billing/subscription-service';
import { createWechatRefund, queryWechatRefund } from '@/lib/billing/wechat-pay';
import { sendRefundNotificationEmail } from '@/lib/email';

const REFUNDABLE_STATUSES = ['paid', 'partial_refunded', 'refunding'];

function newOutRefundNo() {
  return `RF${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
}

// 按退款金额占订单的比例扣回已发放的 credits，避免部分退款时多扣。
function clawbackFor(order, refundFen) {
  if (!order.amountFen) return 0;
  return roundCredits((Number(order.credits) || 0) * (refundFen / order.amountFen));
}

/**
 * 发起退款。credits 不在这里扣 —— 只有微信确认退款成功后才扣回，
 * 否则退款失败会白白扣掉用户余额。
 */
export async function createRefund({ outTradeNo, refundFen, reason, operatorId }) {
  const order = await PaymentOrder.findOne({ outTradeNo });
  if (!order) throw new Error('支付订单不存在');
  if (!REFUNDABLE_STATUSES.includes(order.status)) throw new Error(`订单当前状态（${order.status}）不可退款`);
  const refundable = order.amountFen - (order.refundedFen || 0);
  const amount = Math.floor(Number(refundFen));
  if (!Number.isSafeInteger(amount) || amount < 1) throw new Error('退款金额必须为正整数（分）');
  if (amount > refundable) throw new Error(`退款金额超出可退余额，最多可退 ¥${(refundable / 100).toFixed(2)}`);

  const pending = await RefundRecord.findOne({ paymentOrderId: order._id, status: { $in: ['pending', 'processing'] } });
  if (pending) throw new Error('该订单已有退款正在处理中，请先等待其完成');

  const record = await RefundRecord.create({
    outRefundNo: newOutRefundNo(),
    paymentOrderId: order._id,
    outTradeNo: order.outTradeNo,
    userId: order.userId,
    refundFen: amount,
    totalFen: order.amountFen,
    clawbackCredits: clawbackFor(order, amount),
    status: 'pending',
    reason,
    operatorId,
  });
  await PaymentOrder.updateOne({ _id: order._id, status: { $in: REFUNDABLE_STATUSES } }, { $set: { status: 'refunding' } });

  try {
    const result = await createWechatRefund({
      outTradeNo: order.outTradeNo,
      outRefundNo: record.outRefundNo,
      refundFen: amount,
      totalFen: order.amountFen,
      reason,
    });
    await RefundRecord.updateOne({ _id: record._id }, { $set: { status: 'processing', providerRefundId: result.refund_id } });
    // 微信可能同步就返回 SUCCESS，此时无需等回调。
    if (result.status === 'SUCCESS') {
      return applyRefundResult({ outRefundNo: record.outRefundNo, refundStatus: 'SUCCESS', refundId: result.refund_id, successTime: result.success_time });
    }
    return { refund: await RefundRecord.findById(record._id), pending: true };
  } catch (error) {
    await RefundRecord.updateOne({ _id: record._id }, { $set: { status: 'abnormal', errorMessage: error.message } });
    // 发起失败就把订单状态放回去，允许重试。
    await PaymentOrder.updateOne({ _id: order._id, status: 'refunding' }, { $set: { status: (order.refundedFen || 0) > 0 ? 'partial_refunded' : 'paid' } });
    throw error;
  }
}

/**
 * 落地退款结果。回调和管理端手工同步都走这里，靠 RefundRecord 的状态 CAS 保证只生效一次。
 */
export async function applyRefundResult({ outRefundNo, refundStatus, refundId, successTime }) {
  const record = await RefundRecord.findOne({ outRefundNo });
  if (!record) throw new Error('退款单不存在');

  if (refundStatus !== 'SUCCESS') {
    const failedStatus = refundStatus === 'CLOSED' ? 'closed' : 'abnormal';
    await RefundRecord.updateOne({ _id: record._id, status: { $in: ['pending', 'processing'] } }, { $set: { status: failedStatus, errorMessage: `微信退款状态 ${refundStatus}` } });
    const order = await PaymentOrder.findById(record.paymentOrderId);
    if (order?.status === 'refunding') {
      await PaymentOrder.updateOne({ _id: order._id, status: 'refunding' }, { $set: { status: (order.refundedFen || 0) > 0 ? 'partial_refunded' : 'paid' } });
    }
    return { refund: await RefundRecord.findById(record._id), applied: false };
  }

  // 只有 pending/processing → success 这一次转换会真正扣回额度。
  const claimed = await RefundRecord.findOneAndUpdate(
    { _id: record._id, status: { $in: ['pending', 'processing'] } },
    { $set: { status: 'success', providerRefundId: refundId || record.providerRefundId, succeededAt: successTime ? new Date(successTime) : new Date() } },
    { new: true },
  );
  if (!claimed) return { refund: record, applied: false };

  const order = await PaymentOrder.findById(record.paymentOrderId);
  if (record.clawbackCredits > 0) {
    // allowNegative：用户很可能已经把充值花掉了，此时余额扣成负数，
    // 后续消费会被 reserveTaskCredits 的余额校验挡住，等于欠费冻结。
    await creditUser({
      userId: record.userId,
      key: `wechat-refund:${record.outRefundNo}`,
      delta: -record.clawbackCredits,
      type: 'adjustment',
      description: `退款扣回 · ¥${(record.refundFen / 100).toFixed(2)}`,
      metadata: { source: 'refund', outRefundNo: record.outRefundNo, outTradeNo: record.outTradeNo, refundId, paymentOrderId: record.paymentOrderId },
      allowNegative: true,
    });
  }

  const refundedFen = (order?.refundedFen || 0) + record.refundFen;
  const fullyRefunded = refundedFen >= (order?.amountFen || 0);
  await PaymentOrder.updateOne({ _id: record.paymentOrderId }, {
    $set: { refundedFen, status: fullyRefunded ? 'refunded' : 'partial_refunded' },
  });

  // 订阅订单全额退款要一并撤销会员权益，否则用户退了钱还留着等级。
  if (order?.purpose === 'subscription' && fullyRefunded) {
    await revokeForOrder(order);
  }

  const user = await User.findById(record.userId).select('email').lean();
  if (user?.email) {
    await sendRefundNotificationEmail({
      email: user.email,
      amountYuan: (record.refundFen / 100).toFixed(2),
      outTradeNo: record.outTradeNo,
      clawbackCredits: record.clawbackCredits,
    });
  }
  return { refund: claimed, applied: true, order: await PaymentOrder.findById(record.paymentOrderId) };
}

/**
 * 主动向微信查询退款状态，用于回调丢失时的兜底对账。
 */
export async function syncRefund(outRefundNo) {
  const result = await queryWechatRefund(outRefundNo);
  return applyRefundResult({
    outRefundNo,
    refundStatus: result.status,
    refundId: result.refund_id,
    successTime: result.success_time,
  });
}

export async function syncPendingRefunds({ limit = 50, olderThanMs = 60_000 } = {}) {
  const stale = await RefundRecord.find({ status: { $in: ['pending', 'processing'] }, updatedAt: { $lt: new Date(Date.now() - olderThanMs) } }).limit(limit);
  const results = [];
  for (const record of stale) {
    try {
      const outcome = await syncRefund(record.outRefundNo);
      results.push({ outRefundNo: record.outRefundNo, applied: outcome.applied });
    } catch (error) {
      results.push({ outRefundNo: record.outRefundNo, error: error.message });
    }
  }
  return results;
}
