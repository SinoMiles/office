import crypto from 'node:crypto';

// 腾讯云 TC3-HMAC-SHA256 签名。单独成文件有两个原因：
// 一是签名是这条链路上最容易写错、又最难从错误信息看出来的一段
// （签错只会得到含糊的 AuthFailure.SignatureFailure），值得单测锁住；
// 二是 lib/sms.js 带 'server-only'，测试导入不进来。

const sha256hex = (value) => crypto.createHash('sha256').update(value, 'utf8').digest('hex');
const hmac = (key, value) => crypto.createHmac('sha256', key).update(value, 'utf8').digest();

export function tc3Authorization({ secretId, secretKey, host, service, action, payload, timestamp }) {
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
  const signedHeaders = 'content-type;host;x-tc-action';
  // 被签名的头必须小写、按字典序排列，且值也要小写化——这三点任一不符都会签失败。
  const canonicalRequest = [
    'POST',
    '/',
    '',
    'content-type:application/json; charset=utf-8',
    `host:${host}`,
    `x-tc-action:${String(action).toLowerCase()}`,
    '',
    signedHeaders,
    sha256hex(payload),
  ].join('\n');

  const scope = `${date}/${service}/tc3_request`;
  const stringToSign = ['TC3-HMAC-SHA256', String(timestamp), scope, sha256hex(canonicalRequest)].join('\n');
  const signingKey = hmac(hmac(hmac(`TC3${secretKey}`, date), service), 'tc3_request');
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign, 'utf8').digest('hex');
  return `TC3-HMAC-SHA256 Credential=${secretId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}
