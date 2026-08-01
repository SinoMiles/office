import crypto from 'node:crypto';

function sharedSecret() {
  return process.env.OFFICEGPT_CORE_SHARED_SECRET || process.env.JWT_SECRET || '';
}

export function createAioncoreBridgeToken(userId) {
  const subject = String(userId || '').trim();
  const secret = sharedSecret();
  if (!subject || !/^[A-Za-z0-9_-]{1,128}$/.test(subject)) throw new Error('INVALID_AIONCORE_USER_ID');
  if (secret.length < 32) throw new Error('OFFICEGPT_CORE_SHARED_SECRET_REQUIRED');
  const encoded = Buffer.from(subject).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(subject).digest('hex');
  return `officegpt.${encoded}.${signature}`;
}

export function aioncoreHeaders(userId, initial = {}) {
  const headers = new Headers(initial);
  headers.set('Authorization', `Bearer ${createAioncoreBridgeToken(userId)}`);
  return headers;
}
