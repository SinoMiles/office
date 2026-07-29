import assert from 'node:assert/strict';
import test from 'node:test';
import { getPlan, listPlans, nextPeriodEnd, normalizePlanSettings, quotePlan } from '../lib/billing/plans.js';

test('ships only the PRO plan with sane defaults', () => {
  const plans = listPlans({});
  assert.deepEqual(plans.map((plan) => plan.id), ['PRO']);
  assert.equal(getPlan({}, 'PRO').monthlyFen, 1900);
  assert.equal(getPlan({}, 'ENTERPRISE'), null);
  assert.equal(getPlan({}, 'NOPE'), null);
});

test('rejects plans whose membership level cannot be stored on the user', () => {
  const { plans } = normalizePlanSettings({ plans: { HACK: { membershipLevel: 'GODMODE', monthlyFen: 1 } } });
  assert.equal(plans.HACK, undefined);
  // 合法覆盖仍然生效
  const { plans: overridden } = normalizePlanSettings({ plans: { PRO: { monthlyFen: 1900 } } });
  assert.equal(overridden.PRO.monthlyFen, 1900);
  assert.equal(overridden.PRO.membershipLevel, 'PRO');
});

test('legacy enterprise configuration never returns to the sales catalog', () => {
  const settings = { plans: { ENTERPRISE: { membershipLevel: 'ENTERPRISE', enabled: true, monthlyFen: 1 } } };
  assert.deepEqual(listPlans(settings).map((plan) => plan.id), ['PRO']);
  assert.equal(getPlan(settings, 'ENTERPRISE'), null);
});

test('longer periods apply their discount and grant the full period credits', () => {
  const monthly = quotePlan({}, 'PRO', 1);
  assert.equal(monthly.amountFen, 1900);
  assert.equal(monthly.grantCredits, 30000);
  assert.equal(monthly.savedFen, 0);

  const yearly = quotePlan({}, 'PRO', 12);
  // 1900 * 12 * 0.85 = 19380
  assert.equal(yearly.amountFen, 19380);
  assert.equal(yearly.listAmountFen, 22800);
  assert.equal(yearly.savedFen, 3420);
  // 折扣只作用于价格，赠送额度按整周期足额发放
  assert.equal(yearly.grantCredits, 360000);
});

test('unknown plan or period yields no quote instead of a bogus order', () => {
  assert.equal(quotePlan({}, 'PRO', 7), null);
  assert.equal(quotePlan({}, 'GHOST', 1), null);
});

test('renewal stacks onto the remaining period instead of overwriting it', () => {
  const now = new Date('2026-07-26T00:00:00Z');
  const currentEnd = new Date('2026-09-26T00:00:00Z');
  const extended = nextPeriodEnd(currentEnd, 1, now);
  assert.equal(extended.toISOString().slice(0, 10), '2026-10-26');
});

test('renewal after expiry restarts from now so no paid time is wasted', () => {
  const now = new Date('2026-07-26T00:00:00Z');
  const expiredEnd = new Date('2026-06-01T00:00:00Z');
  const restarted = nextPeriodEnd(expiredEnd, 1, now);
  assert.equal(restarted.toISOString().slice(0, 10), '2026-08-26');
});

test('month-end subscriptions do not overflow into the following month', () => {
  // 1/31 + 1 个月在 JS 里会溢出到 3/2 或 3/3，必须回退到 2 月最后一天
  const start = new Date(2026, 0, 31);
  const end = nextPeriodEnd(start, 1, new Date(2026, 0, 1));
  assert.equal(end.getMonth(), 1);
  assert.equal(end.getDate(), 28);
});

test('period catalog can be overridden and is returned in ascending order', () => {
  const { periods } = normalizePlanSettings({ periods: [{ months: 6, label: '半年付', rate: 0.9 }, { months: 1, label: '月付', rate: 1 }] });
  assert.deepEqual(periods.map((period) => period.months), [1, 6]);
  assert.equal(quotePlan({ periods: [{ months: 6, label: '半年付', rate: 0.9 }] }, 'PRO', 6).amountFen, 10260);
});
