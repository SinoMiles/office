import assert from 'node:assert/strict';
import test from 'node:test';
import { generateRechargeCode, hashRechargeCode, normalizeRechargeCode } from '../lib/billing/recharge-code.js';

test('recharge codes normalize consistently and are stored as hashes', () => {
  const code = generateRechargeCode();
  assert.match(code, /^OFFICE-[A-F0-9]{8}-[A-F0-9]{8}-[A-F0-9]{8}$/);
  assert.equal(normalizeRechargeCode(code.toLowerCase()), normalizeRechargeCode(code));
  assert.equal(hashRechargeCode(code.toLowerCase()), hashRechargeCode(code));
  assert.doesNotMatch(hashRechargeCode(code), /OFFICE/);
});
