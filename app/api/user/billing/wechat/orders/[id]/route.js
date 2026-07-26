import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { fulfillPaymentOrder } from '@/lib/billing/payment-service';
import { closeWechatOrder, queryWechatOrder } from '@/lib/billing/wechat-pay';
import PaymentOrder from '@/models/PaymentOrder';

export const runtime = 'nodejs';

export async function GET(_request, { params }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });
  await connectToDatabase();
  const { id } = await params;
  let order = await PaymentOrder.findOne({ _id: id, userId: user._id });
  if (!order) return NextResponse.json({ error: '充值订单不存在' }, { status: 404 });
  if (order.status === 'paying' && order.expiresAt.getTime() <= Date.now()) {
    await closeWechatOrder(order.outTradeNo).catch(() => undefined);
    await PaymentOrder.updateOne({ _id: order._id, status: 'paying' }, { $set: { status: 'closed', errorMessage: '支付二维码已过期' } });
    order = await PaymentOrder.findById(order._id);
  }
  const shouldQuery = order.status === 'paying' && (!order.lastQueriedAt || Date.now() - order.lastQueriedAt.getTime() > 3000);
  if (shouldQuery) {
    order.lastQueriedAt = new Date();
    await order.save();
    try {
      const result = await queryWechatOrder(order.outTradeNo);
      if (result.trade_state === 'SUCCESS') {
        await fulfillPaymentOrder({ outTradeNo: order.outTradeNo, transactionId: result.transaction_id, amountFen: result.amount?.total, paidAt: result.success_time ? new Date(result.success_time) : new Date() });
      } else if (['CLOSED', 'REVOKED', 'PAYERROR'].includes(result.trade_state)) {
        await PaymentOrder.updateOne({ _id: order._id }, { $set: { status: 'closed', errorMessage: result.trade_state_desc } });
      }
      order = await PaymentOrder.findById(order._id);
    } catch {
      // Callback remains authoritative. A transient query failure should not
      // turn a valid payment into a failed order.
    }
  }
  return NextResponse.json({ success: true, order: { id: String(order._id), status: order.status === 'crediting' ? 'paying' : order.status, purpose: order.purpose, planId: order.planId, periodMonths: order.periodMonths, amountYuan: order.amountFen / 100, credits: order.credits, expiresAt: order.expiresAt, paidAt: order.paidAt } });
}
