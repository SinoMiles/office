import { NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { fulfillPaymentOrder } from '@/lib/billing/payment-service';
import { syncRefund } from '@/lib/billing/refund-service';
import { queryWechatOrder } from '@/lib/billing/wechat-pay';
import PaymentOrder from '@/models/PaymentOrder';
import RefundRecord from '@/models/RefundRecord';

export const runtime = 'nodejs';

// 人工对账入口：以微信侧状态为准，把本地订单和退款单拉齐。
// 回调丢失、用户报「付了钱没到账」时用这个补救。
export async function POST(_request, { params }) {
  const admin = await getCurrentAdmin();
  if (!admin || admin.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  const { id } = await params;
  await connectToDatabase();
  const order = await PaymentOrder.findById(id);
  if (!order) return NextResponse.json({ error: '支付订单不存在' }, { status: 404 });

  const actions = [];
  try {
    const result = await queryWechatOrder(order.outTradeNo);
    actions.push({ step: 'query', tradeState: result.trade_state });
    if (result.trade_state === 'SUCCESS') {
      const outcome = await fulfillPaymentOrder({
        outTradeNo: order.outTradeNo,
        transactionId: result.transaction_id,
        amountFen: result.amount?.total,
        paidAt: result.success_time ? new Date(result.success_time) : new Date(),
      });
      actions.push({ step: 'fulfill', alreadyPaid: Boolean(outcome.alreadyPaid) });
    } else if (['CLOSED', 'REVOKED', 'PAYERROR'].includes(result.trade_state)) {
      await PaymentOrder.updateOne({ _id: order._id, status: { $in: ['created', 'paying'] } }, { $set: { status: 'closed', errorMessage: result.trade_state_desc } });
      actions.push({ step: 'close' });
    }
  } catch (error) {
    return NextResponse.json({ error: `微信订单查询失败：${error.message}` }, { status: 502 });
  }

  const pendingRefunds = await RefundRecord.find({ paymentOrderId: order._id, status: { $in: ['pending', 'processing'] } });
  for (const refund of pendingRefunds) {
    try {
      const outcome = await syncRefund(refund.outRefundNo);
      actions.push({ step: 'refund', outRefundNo: refund.outRefundNo, applied: outcome.applied });
    } catch (error) {
      actions.push({ step: 'refund', outRefundNo: refund.outRefundNo, error: error.message });
    }
  }

  return NextResponse.json({ success: true, actions, order: await PaymentOrder.findById(order._id).lean() });
}
