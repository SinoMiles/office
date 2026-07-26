import 'server-only';
import { tc3Authorization } from '@/lib/tencent-signature';

// 腾讯云短信。不引 SDK —— TC3-HMAC-SHA256 手写一遍只有几十行，
// 比拖进一个几十兆的依赖划算，也省得 Turbopack 再去处理一个带原生依赖的包。
const HOST = 'sms.tencentcloudapi.com';
const SERVICE = 'sms';
const ACTION = 'SendSms';
const API_VERSION = '2021-01-11';

function credentials() {
  const secretId = process.env.TENCENT_SMS_SECRET_ID;
  const secretKey = process.env.TENCENT_SMS_SECRET_KEY;
  const sdkAppId = process.env.TENCENT_SMS_SDK_APP_ID;
  const signName = process.env.TENCENT_SMS_SIGN_NAME;
  const templateId = process.env.TENCENT_SMS_TEMPLATE_ID;
  if (!secretId || !secretKey || !sdkAppId || !signName || !templateId) return null;
  return { secretId, secretKey, sdkAppId, signName, templateId, region: process.env.TENCENT_SMS_REGION || 'ap-guangzhou' };
}

export function smsConfigured() {
  return Boolean(credentials());
}

export async function sendSmsCode({ phone, code }) {
  const config = credentials();
  if (!config) {
    // 没配密钥时把验证码打到服务端日志，前后端联调不至于卡住；
    // 生产上缺配置必须报错，否则会静默地放任何人过验证。
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[auth:sms] bind code for ${phone}: ${code}`);
      return { sent: false, reason: 'sms_not_configured' };
    }
    throw new Error('短信服务尚未配置');
  }

  const payload = JSON.stringify({
    PhoneNumberSet: [`+86${phone}`],
    SmsSdkAppId: config.sdkAppId,
    SignName: config.signName,
    TemplateId: config.templateId,
    TemplateParamSet: [String(code)],
  });
  const timestamp = Math.floor(Date.now() / 1000);

  const response = await fetch(`https://${HOST}`, {
    method: 'POST',
    headers: {
      Authorization: tc3Authorization({ ...config, host: HOST, service: SERVICE, action: ACTION, payload, timestamp }),
      'Content-Type': 'application/json; charset=utf-8',
      Host: HOST,
      'X-TC-Action': ACTION,
      'X-TC-Version': API_VERSION,
      'X-TC-Timestamp': String(timestamp),
      'X-TC-Region': config.region,
    },
    body: payload,
  });
  const body = await response.json().catch(() => ({}));
  const result = body?.Response || {};
  const status = result.SendStatusSet?.[0];

  // 两层错误：接口级的 Response.Error，和单条号码级的 SendStatusSet[].Code。
  // 后者才装得下「模板未审核」「余额不足」「号码被限频」这类真正常见的失败。
  if (!response.ok || result.Error || status?.Code !== 'Ok') {
    const reason = result.Error?.Code || status?.Code || `HTTP ${response.status}`;
    const detail = result.Error?.Message || status?.Message || '';
    // 原样记下来便于排查，但不透给前端 —— 里面会带上签名与模板信息。
    console.error('[auth:sms] 发送失败', reason, detail);
    throw new Error('验证码发送失败，请稍后重试');
  }
  return { sent: true, serialNo: status.SerialNo };
}
