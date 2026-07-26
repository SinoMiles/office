import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import Subscription from '@/models/Subscription';

export const runtime = 'nodejs';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });
  await connectToDatabase();
  const subscription = await Subscription.findOne({ userId: user._id, status: 'active' }).lean();
  const history = await Subscription.find({ userId: user._id, status: { $ne: 'active' } }).sort({ updatedAt: -1 }).limit(5).lean();
  return NextResponse.json({
    success: true,
    membershipLevel: user.membershipLevel,
    subscription: subscription ? {
      id: String(subscription._id),
      planId: subscription.planId,
      membershipLevel: subscription.membershipLevel,
      periodMonths: subscription.periodMonths,
      periodCount: subscription.periodCount,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      monthlyCredits: subscription.monthlyCredits,
      autoRenew: subscription.autoRenew,
      daysLeft: Math.max(0, Math.ceil((new Date(subscription.currentPeriodEnd).getTime() - Date.now()) / 86_400_000)),
    } : null,
    history: history.map((item) => ({
      id: String(item._id),
      planId: item.planId,
      status: item.status,
      currentPeriodEnd: item.currentPeriodEnd,
    })),
  });
}
