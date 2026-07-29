import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateReservation, calculateUsageCost, createPricingSnapshot, normalizeBillingSettings, normalizeUsage, reconcileDirectCharge, reconcileReservation } from '../lib/billing/pricing.js';

test('normalizes provider usage without trusting negative or malformed values', () => {
  assert.deepEqual(normalizeUsage({ input_tokens: 1200, output_tokens: 300, cache_read_tokens: 200 }), {
    inputTokens: 1200,
    outputTokens: 300,
    cachedInputTokens: 200,
  });
  assert.deepEqual(normalizeUsage({ input_tokens: -1, output_tokens: 'bad' }), { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 });
});

test('prices provider costs with one global sales multiplier', () => {
  const snapshot = createPricingSnapshot(normalizeBillingSettings({}), 'deepseek-v4-flash', 'PRO');
  const cost = calculateUsageCost({ input_tokens: 2000, cache_read_tokens: 1000, output_tokens: 500 }, snapshot);
  assert.equal(cost.totalTokens, 2500);
  assert.equal(snapshot.priceMultiplier, 8);
  assert.equal(snapshot.inputCreditsPer1K, 8);
  assert.equal(snapshot.cachedInputCreditsPer1K, 0.16);
  assert.equal(snapshot.outputCreditsPer1K, 16);
  assert.equal(cost.grossCredits, 16.16);
  assert.equal(cost.chargedCredits, 17);
});

test('reservation uses the fixed safety estimate and the same pricing snapshot', () => {
  const snapshot = createPricingSnapshot({}, 'unknown-model', 'FREE');
  assert.equal(calculateReservation(snapshot), 260);
});

test('final token charge is always a whole Credit and non-zero usage cannot round down to zero', () => {
  const snapshot = createPricingSnapshot({}, 'deepseek-v4-flash', 'FREE');
  assert.equal(calculateUsageCost({ input_tokens: 1 }, snapshot).chargedCredits, 1);
  assert.equal(calculateUsageCost({ input_tokens: 125 }, snapshot).chargedCredits, 1);
  assert.equal(calculateUsageCost({ input_tokens: 126 }, snapshot).chargedCredits, 2);
});

test('admin only changes the global multiplier while credits conversion remains fixed', () => {
  const settings = normalizeBillingSettings({ priceMultiplier: 6, creditsPerCny: 999, models: { default: { inputCreditsPer1K: 99 } } });
  const snapshot = createPricingSnapshot(settings, 'deepseek-v4-flash', 'PRO');
  assert.equal(settings.creditsPerCny, 1000);
  assert.equal(snapshot.inputCreditsPer1K, 6);
  assert.equal(snapshot.cachedInputCreditsPer1K, 0.12);
  assert.equal(snapshot.outputCreditsPer1K, 12);
});

test('settlement refunds unused reservation and identifies overage', () => {
  assert.deepEqual(reconcileReservation(100, 24.5), { reservedCredits: 100, chargedCredits: 24.5, balanceDelta: 75.5, refundedCredits: 75.5, additionalChargeCredits: 0 });
  assert.deepEqual(reconcileReservation(100, 120), { reservedCredits: 100, chargedCredits: 120, balanceDelta: -20, refundedCredits: 0, additionalChargeCredits: 20 });
});

test('direct token billing only deducts actual usage and never refunds', () => {
  assert.deepEqual(reconcileDirectCharge(24.5), { reservedCredits: 0, chargedCredits: 24.5, balanceDelta: -24.5, refundedCredits: 0, additionalChargeCredits: 0 });
});
