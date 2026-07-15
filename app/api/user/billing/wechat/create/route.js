import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { connectToDatabase } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { normalizeBillingSettings } from '@/lib/billing/pricing';
import { createWechatNativeOrder, getWechatPayConfig } from '@/lib/billing/wechat-pay';
import PaymentOrder from '@/models/PaymentOrder';
import SystemSetting from '@/models/SystemSetting';

export const runtime = 'nodejs';

export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });
  const { amountYuan } = await request.json();
  const amountFen = Math.round(Number(amountYuan) * 100);
  if (!Number.isSafeInteger(amountFen) || amountFen < 100 || amountFen > 1_000_000) {
    return NextResponse.json({ error: '单次充值金额须在 ¥1 至 ¥10,000 之间' }, { status: 400 });
  }
  try {
    getWechatPayConfig();
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }
  await connectToDatabase();
  const billingSetting = await SystemSetting.findOne({ key: 'billing' }).lean();
  const pricing = normalizeBillingSettings(billingSetting?.value || {});
  const credits = Math.round((amountFen / 100) * pricing.creditsPerCny * 1_000_000) / 1_000_000;
  const outTradeNo = `OW${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
  const expiresAt = new Date(Date.now() + 10 * 60_000);
  const order = await PaymentOrder.create({ outTradeNo, userId: user._id, amountFen, credits, status: 'created', expiresAt });
  try {
    const result = await createWechatNativeOrder({ outTradeNo, description: `OfficeWeb ${credits} Credits`, amountFen, expiresAt });
    order.status = 'paying';
    order.codeUrl = result.code_url;
    await order.save();
    const qrCodeDataUrl = await QRCode.toDataURL(result.code_url, { width: 280, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#111827', light: '#FFFFFF' } });
    return NextResponse.json({ success: true, orderId: String(order._id), outTradeNo, amountYuan: amountFen / 100, credits, expiresAt, qrCodeDataUrl });
  } catch (error) {
    await PaymentOrder.updateOne({ _id: order._id }, { $set: { status: 'failed', errorMessage: error.message } });
    return NextResponse.json({ error: error.message }, { status: 502 });
  }
}
