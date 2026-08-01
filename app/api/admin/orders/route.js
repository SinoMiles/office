import { NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import PaymentOrder from '@/models/PaymentOrder';
import RefundRecord from '@/models/RefundRecord';

export const runtime = 'nodejs';

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(request) {
  const admin = await getCurrentAdmin();
  if (!admin || admin.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  await connectToDatabase();

  const { searchParams } = new URL(request.url);
  const page = positiveInteger(searchParams.get('page'), 1);
  const pageSize = Math.min(100, Math.max(10, positiveInteger(searchParams.get('pageSize'), 20)));
  const status = searchParams.get('status');
  const purpose = searchParams.get('purpose');
  const keyword = (searchParams.get('keyword') || '').trim();

  const query = {
    ...(status && status !== 'all' ? { status } : {}),
    ...(purpose && purpose !== 'all' ? { purpose } : {}),
    // 关键字支持商户单号与微信交易号，客服拿到任一编号都能定位。
    ...(keyword ? { $or: [{ outTradeNo: keyword }, { providerTransactionId: keyword }] } : {}),
  };

  const [orders, total, stats] = await Promise.all([
    PaymentOrder.find(query).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).populate('userId', 'phone membershipLevel').lean(),
    PaymentOrder.countDocuments(query),
    PaymentOrder.aggregate([
      { $match: { status: { $in: ['paid', 'partial_refunded', 'refunded'] } } },
      { $group: { _id: null, grossFen: { $sum: '$amountFen' }, refundedFen: { $sum: '$refundedFen' }, count: { $sum: 1 } } },
    ]),
  ]);

  const orderIds = orders.map((order) => order._id);
  const refunds = orderIds.length ? await RefundRecord.find({ paymentOrderId: { $in: orderIds } }).sort({ createdAt: -1 }).lean() : [];
  const refundsByOrder = new Map();
  for (const refund of refunds) {
    const key = String(refund.paymentOrderId);
    if (!refundsByOrder.has(key)) refundsByOrder.set(key, []);
    refundsByOrder.get(key).push({
      outRefundNo: refund.outRefundNo,
      refundFen: refund.refundFen,
      status: refund.status,
      reason: refund.reason,
      createdAt: refund.createdAt,
      succeededAt: refund.succeededAt,
    });
  }

  const summary = stats[0] || { grossFen: 0, refundedFen: 0, count: 0 };
  return NextResponse.json({
    success: true,
    orders: orders.map((order) => ({
      id: String(order._id),
      outTradeNo: order.outTradeNo,
      providerTransactionId: order.providerTransactionId,
      purpose: order.purpose,
      planId: order.planId,
      periodMonths: order.periodMonths,
      status: order.status,
      amountYuan: order.amountFen / 100,
      refundedYuan: (order.refundedFen || 0) / 100,
      refundableYuan: (order.amountFen - (order.refundedFen || 0)) / 100,
      credits: order.credits,
      user: order.userId ? { id: String(order.userId._id), phone: order.userId.phone, membershipLevel: order.userId.membershipLevel } : null,
      createdAt: order.createdAt,
      paidAt: order.paidAt,
      errorMessage: order.errorMessage,
      refunds: refundsByOrder.get(String(order._id)) || [],
    })),
    summary: {
      paidOrders: summary.count,
      grossYuan: summary.grossFen / 100,
      refundedYuan: summary.refundedFen / 100,
      netYuan: (summary.grossFen - summary.refundedFen) / 100,
    },
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  });
}
