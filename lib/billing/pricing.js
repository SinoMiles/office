export const BILLING_UNIT = 'credits';
export const BILLING_VERSION = 2;

const DEFAULT_PRICING = Object.freeze({
  currency: 'CREDITS',
  creditsPerCny: 1000,
  priceMultiplier: 8,
  reservationInputTokens: 16_000,
  reservationOutputTokens: 8_192,
});

// 供应商成本属于代码版本的一部分，不由运营后台手工维护。
// 单位为人民币 / 1,000,000 Tokens；供应商调价时在这里更新并发布。
const PROVIDER_COSTS = Object.freeze({
  default: { inputCnyPer1M: 1, outputCnyPer1M: 2, cachedInputCnyPer1M: 0.02 },
  'deepseek-v4-flash': { inputCnyPer1M: 1, outputCnyPer1M: 2, cachedInputCnyPer1M: 0.02 },
});

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

export function roundCredits(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.round((number + Number.EPSILON) * 1_000_000) / 1_000_000;
}

// Credits 是面向用户展示和结算的最小单位。Token 成本先按精度计算，
// 最终扣款统一向上取整，既不产生小数余额，也避免极小任务被舍入成 0。
export function roundChargeCredits(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return Math.ceil(number);
}

export function normalizeUsage(value = {}) {
  return {
    inputTokens: Math.floor(finiteNumber(value.input_tokens)),
    outputTokens: Math.floor(finiteNumber(value.output_tokens)),
    cachedInputTokens: Math.floor(finiteNumber(value.cache_read_tokens)),
  };
}

export function normalizeBillingSettings(value = {}) {
  return {
    version: BILLING_VERSION,
    currency: 'CREDITS',
    creditsPerCny: DEFAULT_PRICING.creditsPerCny,
    priceMultiplier: Math.max(1, finiteNumber(value.priceMultiplier, DEFAULT_PRICING.priceMultiplier) || DEFAULT_PRICING.priceMultiplier),
    reservationInputTokens: DEFAULT_PRICING.reservationInputTokens,
    reservationOutputTokens: DEFAULT_PRICING.reservationOutputTokens,
  };
}

export function createPricingSnapshot(settings, model, membershipLevel = 'FREE') {
  const normalized = normalizeBillingSettings(settings);
  const providerCosts = PROVIDER_COSTS[model] || PROVIDER_COSTS.default;
  const creditsFactor = normalized.creditsPerCny * normalized.priceMultiplier / 1000;
  return {
    version: normalized.version,
    unit: BILLING_UNIT,
    model,
    membershipLevel,
    priceMultiplier: normalized.priceMultiplier,
    providerCosts,
    inputCreditsPer1K: roundCredits(providerCosts.inputCnyPer1M * creditsFactor),
    outputCreditsPer1K: roundCredits(providerCosts.outputCnyPer1M * creditsFactor),
    cachedInputCreditsPer1K: roundCredits(providerCosts.cachedInputCnyPer1M * creditsFactor),
    reservationInputTokens: normalized.reservationInputTokens,
    reservationOutputTokens: normalized.reservationOutputTokens,
  };
}

export function calculateUsageCost(usageValue, snapshot) {
  const usage = normalizeUsage(usageValue);
  const billableInputTokens = Math.max(0, usage.inputTokens - usage.cachedInputTokens);
  const grossCredits = (
    billableInputTokens * snapshot.inputCreditsPer1K
    + usage.cachedInputTokens * snapshot.cachedInputCreditsPer1K
    + usage.outputTokens * snapshot.outputCreditsPer1K
  ) / 1000;
  return {
    ...usage,
    totalTokens: usage.inputTokens + usage.outputTokens,
    grossCredits: roundCredits(grossCredits),
    chargedCredits: roundChargeCredits(grossCredits * (Number(snapshot.version || 1) < 2 ? Number(snapshot.discountRate ?? 1) : 1)),
  };
}

export function calculateReservation(snapshot) {
  return calculateUsageCost({
    input_tokens: snapshot.reservationInputTokens,
    output_tokens: snapshot.reservationOutputTokens,
  }, snapshot).chargedCredits;
}

export function reconcileReservation(reservationCredits, chargedCredits) {
  const reserved = roundCredits(reservationCredits);
  const charged = roundCredits(chargedCredits);
  const balanceDelta = roundCredits(reserved - charged);
  return {
    reservedCredits: reserved,
    chargedCredits: charged,
    balanceDelta,
    refundedCredits: Math.max(0, balanceDelta),
    additionalChargeCredits: Math.max(0, -balanceDelta),
  };
}

export function reconcileDirectCharge(chargedCredits) {
  const charged = roundCredits(chargedCredits);
  return { reservedCredits: 0, chargedCredits: charged, balanceDelta: -charged, refundedCredits: 0, additionalChargeCredits: 0 };
}
