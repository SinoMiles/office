import 'server-only';
import crypto from 'node:crypto';
import AuthRateLimit from '@/models/AuthRateLimit';
import CaptchaChallenge from '@/models/CaptchaChallenge';
import EmailVerification from '@/models/EmailVerification';

export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function requestIp(request) {
  return String(request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown').trim();
}

export async function consumeRateLimit({ scope, identifier, limit, windowMs }) {
  const bucket = Math.floor(Date.now() / windowMs);
  const key = `${scope}:${identifier}:${bucket}`;
  const result = await AuthRateLimit.findOneAndUpdate(
    { key },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((bucket + 2) * windowMs) } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return { allowed: result.count <= limit, retryAfter: Math.max(1, Math.ceil(((bucket + 1) * windowMs - Date.now()) / 1000)) };
}

function secretHash(value) {
  const secret = process.env.AUTH_CODE_SECRET || process.env.JWT_SECRET;
  return crypto.createHmac('sha256', secret).update(String(value)).digest('hex');
}

export async function createCaptcha() {
  const alphabet = '346789ABCDEFGHJKLMNPQRTUVWXY';
  const answer = Array.from({ length: 5 }, () => alphabet[crypto.randomInt(alphabet.length)]).join('');
  const challenge = await CaptchaChallenge.create({ answerHash: secretHash(answer), expiresAt: new Date(Date.now() + 5 * 60_000) });
  const noise = Array.from({ length: 8 }, (_, index) => `<line x1="${index * 22}" y1="${crypto.randomInt(8, 54)}" x2="${index * 22 + 45}" y2="${crypto.randomInt(8, 54)}" stroke="#94a3b8" opacity=".35"/>`).join('');
  const glyphs = [...answer].map((character, index) => `<text x="${22 + index * 34}" y="${42 + crypto.randomInt(-4, 5)}" transform="rotate(${crypto.randomInt(-15, 16)} ${22 + index * 34} 34)">${character}</text>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="60"><rect width="100%" height="100%" rx="10" fill="#f1f5f9"/>${noise}<g font-family="ui-monospace,monospace" font-size="28" font-weight="700" fill="#0f172a">${glyphs}</g></svg>`;
  return { id: String(challenge._id), image: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}` };
}

export async function verifyCaptcha(id, answer) {
  if (!id || !answer) return false;
  const challenge = await CaptchaChallenge.findOneAndUpdate(
    { _id: id, consumedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { consumedAt: new Date() } },
    { new: true },
  ).lean();
  if (!challenge) return false;
  const expected = Buffer.from(challenge.answerHash);
  const actual = Buffer.from(secretHash(String(answer).trim().toUpperCase()));
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

export function verificationCodeHash(email, purpose, code) {
  return secretHash(`${normalizeEmail(email)}:${purpose}:${code}`);
}

export async function consumeEmailCode({ email, purpose, code }) {
  const normalized = normalizeEmail(email);
  const verification = await EmailVerification.findOne({
    email: normalized,
    purpose,
    consumedAt: null,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });
  if (!verification || verification.attempts >= 5) return false;
  verification.attempts += 1;
  const expected = Buffer.from(verification.codeHash);
  const actual = Buffer.from(verificationCodeHash(normalized, purpose, code));
  const matches = expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  if (matches) verification.consumedAt = new Date();
  await verification.save();
  return matches;
}
