import 'server-only';
import crypto from 'node:crypto';
import fs from 'node:fs';

const API_BASE = 'https://api.mch.weixin.qq.com';

function required(name, value) {
  if (!value) throw new Error(`微信支付尚未配置 ${name}`);
  return value;
}

function pem(value) {
  const normalized = String(value || '').replaceAll('\\n', '\n');
  if (normalized.includes('-----BEGIN')) return normalized;
  return Buffer.from(normalized, 'base64').toString('utf8');
}

function pemFromEnv(valueName, fileName) {
  const value = process.env[valueName];
  const file = process.env[fileName];
  if (value) return pem(value);
  if (file) return fs.readFileSync(file, 'utf8');
  throw new Error(`微信支付尚未配置 ${valueName} 或 ${fileName}`);
}

export function getWechatPayConfig() {
  return {
    appId: required('WECHAT_PAY_APP_ID', process.env.WECHAT_PAY_APP_ID),
    mchId: required('WECHAT_PAY_MCH_ID', process.env.WECHAT_PAY_MCH_ID),
    serialNo: required('WECHAT_PAY_CERT_SERIAL_NO', process.env.WECHAT_PAY_CERT_SERIAL_NO),
    privateKey: pemFromEnv('WECHAT_PAY_PRIVATE_KEY', 'WECHAT_PAY_PRIVATE_KEY_FILE'),
    apiV3Key: required('WECHAT_PAY_API_V3_KEY', process.env.WECHAT_PAY_API_V3_KEY),
    platformPublicKey: pemFromEnv('WECHAT_PAY_PLATFORM_PUBLIC_KEY', 'WECHAT_PAY_PLATFORM_PUBLIC_KEY_FILE'),
    platformSerialNo: process.env.WECHAT_PAY_PLATFORM_SERIAL_NO || '',
    notifyUrl: required('WECHAT_PAY_NOTIFY_URL', process.env.WECHAT_PAY_NOTIFY_URL),
  };
}

function nonce() {
  return crypto.randomBytes(16).toString('hex');
}

function signMessage(message, privateKey) {
  return crypto.sign('RSA-SHA256', Buffer.from(message), privateKey).toString('base64');
}

async function wechatRequest(method, pathname, bodyValue) {
  const config = getWechatPayConfig();
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonceStr = nonce();
  const body = bodyValue ? JSON.stringify(bodyValue) : '';
  const message = `${method}\n${pathname}\n${timestamp}\n${nonceStr}\n${body}\n`;
  const signature = signMessage(message, config.privateKey);
  const authorization = `WECHATPAY2-SHA256-RSA2048 mchid="${config.mchId}",nonce_str="${nonceStr}",timestamp="${timestamp}",serial_no="${config.serialNo}",signature="${signature}"`;
  const response = await fetch(`${API_BASE}${pathname}`, {
    method,
    headers: { Authorization: authorization, Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'OfficeWeb/1.0' },
    body: body || undefined,
  });
  const responseBody = await response.text();
  const responseTimestamp = response.headers.get('wechatpay-timestamp');
  const responseNonce = response.headers.get('wechatpay-nonce');
  const responseSignature = response.headers.get('wechatpay-signature');
  const responseSerial = response.headers.get('wechatpay-serial');
  if (!verifyWechatSignature({ timestamp: responseTimestamp, nonce: responseNonce, signature: responseSignature, serial: responseSerial, body: responseBody, enforceFreshness: false })) {
    throw new Error('微信支付响应签名验证失败');
  }
  const payload = responseBody ? JSON.parse(responseBody) : {};
  if (!response.ok) throw new Error(payload.message || `微信支付请求失败（${response.status}）`);
  return payload;
}

export async function createWechatNativeOrder({ outTradeNo, description, amountFen, expiresAt }) {
  const config = getWechatPayConfig();
  return wechatRequest('POST', '/v3/pay/transactions/native', {
    appid: config.appId,
    mchid: config.mchId,
    description,
    out_trade_no: outTradeNo,
    notify_url: config.notifyUrl,
    time_expire: expiresAt.toISOString(),
    amount: { total: amountFen, currency: 'CNY' },
  });
}

export async function queryWechatOrder(outTradeNo) {
  const config = getWechatPayConfig();
  const pathname = `/v3/pay/transactions/out-trade-no/${encodeURIComponent(outTradeNo)}?mchid=${encodeURIComponent(config.mchId)}`;
  return wechatRequest('GET', pathname);
}

export async function closeWechatOrder(outTradeNo) {
  const config = getWechatPayConfig();
  return wechatRequest('POST', `/v3/pay/transactions/out-trade-no/${encodeURIComponent(outTradeNo)}/close`, { mchid: config.mchId });
}

function verifyWechatSignature({ timestamp, nonce: callbackNonce, signature, serial, body, enforceFreshness = true }) {
  const config = getWechatPayConfig();
  if (config.platformSerialNo && serial !== config.platformSerialNo) return false;
  if (!timestamp || (enforceFreshness && Math.abs(Date.now() / 1000 - Number(timestamp)) > 300)) return false;
  return crypto.verify('RSA-SHA256', Buffer.from(`${timestamp}\n${callbackNonce}\n${body}\n`), config.platformPublicKey, Buffer.from(signature || '', 'base64'));
}

export function verifyWechatCallback(value) {
  return verifyWechatSignature(value);
}

export function decryptWechatResource(resource) {
  const config = getWechatPayConfig();
  if (Buffer.byteLength(config.apiV3Key) !== 32) throw new Error('WECHAT_PAY_API_V3_KEY 必须为 32 字节');
  const ciphertext = Buffer.from(resource.ciphertext, 'base64');
  const authTag = ciphertext.subarray(ciphertext.length - 16);
  const encrypted = ciphertext.subarray(0, ciphertext.length - 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(config.apiV3Key), Buffer.from(resource.nonce));
  decipher.setAuthTag(authTag);
  decipher.setAAD(Buffer.from(resource.associated_data || ''));
  return JSON.parse(Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8'));
}
