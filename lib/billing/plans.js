export const PLAN_VERSION = 1;

// 会员套餐目录。折扣倍率不在这里定义 —— 它是 billing 设置里 discountRates 的职责，
// 套餐只声明自己对应哪个 membershipLevel，避免两处配置打架。
const DEFAULT_PLANS = Object.freeze({
  PRO: {
    id: 'PRO',
    membershipLevel: 'PRO',
    name: '专业版',
    monthlyFen: 2900,
    monthlyCredits: 3000,
    highlights: ['Token 单价 8 折', '每月赠送 3,000 Credits', '任务并发上限提升至 5'],
  },
  ENTERPRISE: {
    id: 'ENTERPRISE',
    membershipLevel: 'ENTERPRISE',
    name: '企业版',
    monthlyFen: 29900,
    monthlyCredits: 50000,
    highlights: ['Token 单价 5 折', '每月赠送 50,000 Credits', '任务并发上限提升至 20', '优先技术支持'],
  },
});

// 长周期折扣：买得越久越便宜。倍率作用在“月费 × 月数”之上。
const DEFAULT_PERIODS = Object.freeze([
  { months: 1, label: '月付', rate: 1 },
  { months: 3, label: '季付', rate: 0.95 },
  { months: 12, label: '年付', rate: 0.85 },
]);

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function positiveInteger(value, fallback) {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

export function normalizePlanSettings(value = {}) {
  const configuredPlans = value.plans && typeof value.plans === 'object' ? value.plans : {};
  const plans = {};
  for (const [id, configured] of Object.entries({ ...DEFAULT_PLANS, ...configuredPlans })) {
    const fallback = DEFAULT_PLANS[id] || {};
    const membershipLevel = configured?.membershipLevel || fallback.membershipLevel;
    // 未知等级的套餐直接丢弃，否则会写出一个 User.membershipLevel 枚举放不下的值。
    if (!['PRO', 'ENTERPRISE'].includes(membershipLevel)) continue;
    plans[id] = {
      id,
      membershipLevel,
      name: String(configured?.name || fallback.name || id),
      monthlyFen: positiveInteger(configured?.monthlyFen, fallback.monthlyFen || 0),
      monthlyCredits: finiteNumber(configured?.monthlyCredits, fallback.monthlyCredits || 0),
      highlights: Array.isArray(configured?.highlights) ? configured.highlights.map(String) : (fallback.highlights || []),
      enabled: configured?.enabled !== false,
    };
  }
  const configuredPeriods = Array.isArray(value.periods) && value.periods.length ? value.periods : DEFAULT_PERIODS;
  const periods = configuredPeriods
    .map((period) => ({
      months: positiveInteger(period?.months, 0),
      label: String(period?.label || `${period?.months} 个月`),
      rate: finiteNumber(period?.rate, 1) || 1,
    }))
    .filter((period) => period.months > 0)
    .sort((left, right) => left.months - right.months);
  return { version: PLAN_VERSION, plans, periods: periods.length ? periods : DEFAULT_PERIODS.map((item) => ({ ...item })) };
}

export function listPlans(settings) {
  const normalized = normalizePlanSettings(settings);
  return Object.values(normalized.plans).filter((plan) => plan.enabled);
}

export function getPlan(settings, planId) {
  const normalized = normalizePlanSettings(settings);
  const plan = normalized.plans[planId];
  return plan && plan.enabled ? plan : null;
}

export function getPeriod(settings, months) {
  const normalized = normalizePlanSettings(settings);
  return normalized.periods.find((period) => period.months === positiveInteger(months, -1)) || null;
}

// 订单金额四舍五入到分；赠送额度按整周期发放，不随长周期折扣缩水。
export function quotePlan(settings, planId, months) {
  const plan = getPlan(settings, planId);
  const period = getPeriod(settings, months);
  if (!plan || !period) return null;
  const amountFen = Math.max(1, Math.round(plan.monthlyFen * period.months * period.rate));
  const listAmountFen = plan.monthlyFen * period.months;
  return {
    planId: plan.id,
    planName: plan.name,
    membershipLevel: plan.membershipLevel,
    periodMonths: period.months,
    periodLabel: period.label,
    periodRate: period.rate,
    amountFen,
    listAmountFen,
    savedFen: Math.max(0, listAmountFen - amountFen),
    monthlyCredits: plan.monthlyCredits,
    // 一次付清整个周期，赠送额度也一次性发放到账。
    grantCredits: Math.round(plan.monthlyCredits * period.months * 1_000_000) / 1_000_000,
  };
}

// 续费时把新周期接在旧周期末尾；已过期则从当下重新起算，避免用户白买一段过去的时间。
export function nextPeriodEnd(currentPeriodEnd, months, now = new Date()) {
  const base = currentPeriodEnd && currentPeriodEnd.getTime() > now.getTime() ? new Date(currentPeriodEnd) : new Date(now);
  const result = new Date(base);
  const targetMonth = result.getMonth() + months;
  const dayOfMonth = result.getDate();
  result.setMonth(targetMonth);
  // 1/31 + 1 个月在 JS 里会溢出到 3/2 或 3/3，回退到目标月最后一天。
  if (result.getDate() !== dayOfMonth) result.setDate(0);
  return result;
}
