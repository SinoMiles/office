import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { createRefund } from '@/lib/billing/refund-service';
import PaymentOrder from '@/models/PaymentOrder';

export const runtime = 'nodejs';

export async function POST(request, { params }) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  const { id } = await params;
  const { amountYuan, reason } = await request.json().catch(() => ({}));
  await connectToDatabase();

  const order = await PaymentOrder.findById(id);
  if (!order) return NextResponse.json({ error: '支付订单不存在' }, { status: 404 });

  // 不传金额视为全额退（剩余可退部分）。
  const refundFen = amountYuan === undefined || amountYuan === null || amountYuan === ''
    ? order.amountFen - (order.refundedFen || 0)
    : Math.round(Number(amountYuan) * 100);

  try {
    const result = await createRefund({
      outTradeNo: order.outTradeNo,
      refundFen,
      reason: reason || '用户申请退款',
      operatorId: admin._id,
    });
    return NextResponse.json({
      success: true,
      pending: Boolean(result.pending),
      outRefundNo: result.refund.outRefundNo,
      status: result.refund.status,
      clawbackCredits: result.refund.clawbackCredits,
      message: result.pending ? '退款已提交微信，结果将通过回调确认' : '退款已成功',
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
