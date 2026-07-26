import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { applyRefundResult } from '@/lib/billing/refund-service';
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
  if (resource.mchid && resource.mchid !== config.mchId) {
    return NextResponse.json({ code: 'FAIL', message: '商户身份不匹配' }, { status: 400 });
  }
  await connectToDatabase();
  try {
    // event_type 形如 REFUND.SUCCESS / REFUND.ABNORMAL / REFUND.CLOSED，
    // resource 里的 refund_status 才是权威状态。
    await applyRefundResult({
      outRefundNo: resource.out_refund_no,
      refundStatus: resource.refund_status || String(notification.event_type || '').split('.')[1],
      refundId: resource.refund_id,
      successTime: resource.success_time,
    });
    return NextResponse.json({ code: 'SUCCESS', message: '成功' });
  } catch (error) {
    return NextResponse.json({ code: 'FAIL', message: error.message }, { status: 500 });
  }
}
