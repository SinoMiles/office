import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { normalizeBillingSettings } from '@/lib/billing/pricing';
import { listPlans, normalizePlanSettings, quotePlan } from '@/lib/billing/plans';
import SystemSetting from '@/models/SystemSetting';

export const runtime = 'nodejs';

// 套餐目录是公开信息，定价页和工作台弹窗都从这里取，保证展示与下单口径一致。
export async function GET() {
  await connectToDatabase();
  const [planSetting, billingSetting] = await Promise.all([
    SystemSetting.findOne({ key: 'plans' }).lean(),
    SystemSetting.findOne({ key: 'billing' }).lean(),
  ]);
  const planSettings = planSetting?.value || {};
  const pricing = normalizeBillingSettings(billingSetting?.value || {});
  const { periods } = normalizePlanSettings(planSettings);
  const plans = listPlans(planSettings).map((plan) => ({
    ...plan,
    discountRate: pricing.discountRates[plan.membershipLevel] ?? 1,
    quotes: periods.map((period) => quotePlan(planSettings, plan.id, period.months)).filter(Boolean),
  }));
  return NextResponse.json({ success: true, plans, periods, creditsPerCny: pricing.creditsPerCny });
}
