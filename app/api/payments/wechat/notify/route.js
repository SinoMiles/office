import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { fulfillPaymentOrder } from '@/lib/billing/payment-service';
import { decryptWechatResource, getWechatPayConfig, verifyWechatCallback } from '@/lib/billing/wechat-pay';

export const runtime = 'nodejs';

export async function POST(request) {
  const body = await request.text();
  const timestamp = request.headers.get('wechatpay-timestamp');
  const nonce = request.headers.get('wechatpay-nonce');
  const signature = request.headers.get('wechatpay-signature');
  const serial = request.headers.get('wechatpay-serial');
  if (!timestamp || !nonce || !signature || !serial) return NextResponse.json({ code: 'FAIL', message: '缺少微信支付签名头' }, { status: 401 });
  let verified = false;
  try {
    verified = verifyWechatCallback({ timestamp, nonce, signature, serial, body });
  } catch (error) {
    return NextResponse.json({ code: 'FAIL', message: error.message }, { status: 503 });
  }
  if (!verified) return NextResponse.json({ code: 'FAIL', message: '签名验证失败' }, { status: 401 });
  const notification = JSON.parse(body);
  const resource = decryptWechatResource(notification.resource);
  const config = getWechatPayConfig();
  if (resource.mchid !== config.mchId || resource.appid !== config.appId) return NextResponse.json({ code: 'FAIL', message: '商户身份不匹配' }, { status: 400 });
  if (resource.trade_state !== 'SUCCESS') return NextResponse.json({ code: 'SUCCESS', message: '成功' });
  await connectToDatabase();
  try {
    await fulfillPaymentOrder({ outTradeNo: resource.out_trade_no, transactionId: resource.transaction_id, amountFen: resource.amount?.total, paidAt: resource.success_time ? new Date(resource.success_time) : new Date() });
    return NextResponse.json({ code: 'SUCCESS', message: '成功' });
  } catch (error) {
    return NextResponse.json({ code: 'FAIL', message: error.message }, { status: 500 });
  }
}
