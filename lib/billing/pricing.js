export const BILLING_UNIT = 'credits';
export const BILLING_VERSION = 1;

const DEFAULT_PRICING = Object.freeze({
  currency: 'CREDITS',
  creditsPerCny: 100,
  reservationInputTokens: 16_000,
  reservationOutputTokens: 8_192,
  models: {
    default: { inputCreditsPer1K: 2, outputCreditsPer1K: 8, cachedInputCreditsPer1K: 0.5 },
    'deepseek-v4-flash': { inputCreditsPer1K: 2, outputCreditsPer1K: 8, cachedInputCreditsPer1K: 0.5 },
  },
  discountRates: { FREE: 1, PRO: 0.8, ENTERPRISE: 0.5 },
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

export function normalizeUsage(value = {}) {
  return {
    inputTokens: Math.floor(finiteNumber(value.inputTokens ?? value.input_tokens ?? value.prompt_tokens)),
    outputTokens: Math.floor(finiteNumber(value.outputTokens ?? value.output_tokens ?? value.completion_tokens)),
    cachedInputTokens: Math.floor(finiteNumber(value.cachedInputTokens ?? value.cached_input_tokens ?? value.cache_read_input_tokens)),
  };
}

export function normalizeBillingSettings(value = {}) {
  const legacyInput = finiteNumber(value.inputTokenRate, DEFAULT_PRICING.models.default.inputCreditsPer1K);
  const legacyOutput = finiteNumber(value.outputTokenRate, DEFAULT_PRICING.models.default.outputCreditsPer1K);
  const configuredModels = value.models && typeof value.models === 'object' ? value.models : {};
  const models = {};
  for (const [name, configured] of Object.entries({ ...DEFAULT_PRICING.models, ...configuredModels })) {
    models[name] = {
      inputCreditsPer1K: finiteNumber(configured?.inputCreditsPer1K, legacyInput),
      outputCreditsPer1K: finiteNumber(configured?.outputCreditsPer1K, legacyOutput),
      cachedInputCreditsPer1K: finiteNumber(configured?.cachedInputCreditsPer1K, legacyInput),
    };
  }
  return {
    version: BILLING_VERSION,
    currency: 'CREDITS',
    creditsPerCny: finiteNumber(value.creditsPerCny, DEFAULT_PRICING.creditsPerCny) || DEFAULT_PRICING.creditsPerCny,
    reservationInputTokens: Math.floor(finiteNumber(value.reservationInputTokens, DEFAULT_PRICING.reservationInputTokens)),
    reservationOutputTokens: Math.floor(finiteNumber(value.reservationOutputTokens, DEFAULT_PRICING.reservationOutputTokens)),
    models,
    discountRates: {
      FREE: finiteNumber(value.discountRates?.FREE, 1),
      PRO: finiteNumber(value.discountRates?.PRO, 0.8),
      ENTERPRISE: finiteNumber(value.discountRates?.ENTERPRISE, 0.5),
    },
  };
}

export function createPricingSnapshot(settings, model, membershipLevel = 'FREE') {
  const normalized = normalizeBillingSettings(settings);
  const rates = normalized.models[model] || normalized.models.default;
  return {
    version: normalized.version,
    unit: BILLING_UNIT,
    model,
    membershipLevel,
    discountRate: normalized.discountRates[membershipLevel] ?? 1,
    inputCreditsPer1K: rates.inputCreditsPer1K,
    outputCreditsPer1K: rates.outputCreditsPer1K,
    cachedInputCreditsPer1K: rates.cachedInputCreditsPer1K,
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
    chargedCredits: roundCredits(grossCredits * snapshot.discountRate),
  };
}

export function calculateReservation(snapshot) {
  return calculateUsageCost({
    inputTokens: snapshot.reservationInputTokens,
    outputTokens: snapshot.reservationOutputTokens,
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
