import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { getCurrentUser } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { quotePlan } from '@/lib/billing/plans';
import { createWechatNativeOrder, getWechatPayConfig } from '@/lib/billing/wechat-pay';
import PaymentOrder from '@/models/PaymentOrder';
import SystemSetting from '@/models/SystemSetting';

export const runtime = 'nodejs';

export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });
  const { planId, periodMonths } = await request.json();
  try {
    getWechatPayConfig();
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }
  await connectToDatabase();
  const planSetting = await SystemSetting.findOne({ key: 'plans' }).lean();
  const quote = quotePlan(planSetting?.value || {}, planId, periodMonths);
  if (!quote) return NextResponse.json({ error: '所选套餐或订阅周期不可用' }, { status: 400 });

  // 同一用户短时间内重复点击，复用尚未过期的同规格订单，避免刷出一堆待支付单。
  const reusable = await PaymentOrder.findOne({
    userId: user._id,
    purpose: 'subscription',
    planId: quote.planId,
    periodMonths: quote.periodMonths,
    status: 'paying',
    expiresAt: { $gt: new Date(Date.now() + 60_000) },
  });
  if (reusable?.codeUrl) {
    const qrCodeDataUrl = await QRCode.toDataURL(reusable.codeUrl, { width: 280, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#111827', light: '#FFFFFF' } });
    return NextResponse.json({ success: true, orderId: String(reusable._id), outTradeNo: reusable.outTradeNo, amountYuan: reusable.amountFen / 100, credits: reusable.credits, quote, expiresAt: reusable.expiresAt, qrCodeDataUrl });
  }

  const outTradeNo = `SB${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
  const expiresAt = new Date(Date.now() + 10 * 60_000);
  const order = await PaymentOrder.create({
    outTradeNo,
    userId: user._id,
    purpose: 'subscription',
    planId: quote.planId,
    periodMonths: quote.periodMonths,
    amountFen: quote.amountFen,
    credits: quote.grantCredits,
    status: 'created',
    expiresAt,
  });
  try {
    const result = await createWechatNativeOrder({
      outTradeNo,
      description: `OfficeGPT ${quote.planName} · ${quote.periodLabel}`,
      amountFen: quote.amountFen,
      expiresAt,
    });
    order.status = 'paying';
    order.codeUrl = result.code_url;
    await order.save();
    const qrCodeDataUrl = await QRCode.toDataURL(result.code_url, { width: 280, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#111827', light: '#FFFFFF' } });
    return NextResponse.json({ success: true, orderId: String(order._id), outTradeNo, amountYuan: quote.amountFen / 100, credits: quote.grantCredits, quote, expiresAt, qrCodeDataUrl });
  } catch (error) {
    await PaymentOrder.updateOne({ _id: order._id }, { $set: { status: 'failed', errorMessage: error.message } });
    return NextResponse.json({ error: error.message }, { status: 502 });
  }
}
