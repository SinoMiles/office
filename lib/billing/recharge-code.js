import crypto from 'node:crypto';

export function normalizeRechargeCode(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function hashRechargeCode(value) {
  return crypto.createHash('sha256').update(normalizeRechargeCode(value)).digest('hex');
}

export function generateRechargeCode() {
  const raw = crypto.randomBytes(12).toString('hex').toUpperCase();
  return `OFFICE-${raw.slice(0, 8)}-${raw.slice(8, 16)}-${raw.slice(16, 24)}`;
}
