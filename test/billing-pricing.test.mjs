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

test('prices input, cached input and output independently with membership discount', () => {
  const snapshot = createPricingSnapshot(normalizeBillingSettings({}), 'deepseek-v4-flash', 'PRO');
  const cost = calculateUsageCost({ input_tokens: 2000, cache_read_tokens: 1000, output_tokens: 500 }, snapshot);
  assert.equal(cost.totalTokens, 2500);
  assert.equal(cost.grossCredits, 6.5);
  assert.equal(cost.chargedCredits, 5.2);
});

test('reservation uses the same immutable pricing snapshot as settlement', () => {
  const snapshot = createPricingSnapshot({ reservationInputTokens: 1000, reservationOutputTokens: 1000 }, 'unknown-model', 'FREE');
  assert.equal(calculateReservation(snapshot), 10);
});

test('settlement refunds unused reservation and identifies overage', () => {
  assert.deepEqual(reconcileReservation(100, 24.5), { reservedCredits: 100, chargedCredits: 24.5, balanceDelta: 75.5, refundedCredits: 75.5, additionalChargeCredits: 0 });
  assert.deepEqual(reconcileReservation(100, 120), { reservedCredits: 100, chargedCredits: 120, balanceDelta: -20, refundedCredits: 0, additionalChargeCredits: 20 });
});

test('direct token billing only deducts actual usage and never refunds', () => {
  assert.deepEqual(reconcileDirectCharge(24.5), { reservedCredits: 0, chargedCredits: 24.5, balanceDelta: -24.5, refundedCredits: 0, additionalChargeCredits: 0 });
});
