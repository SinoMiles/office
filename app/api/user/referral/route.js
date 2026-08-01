import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { ensureInviteCode, readReferralSettings } from '@/lib/referral-service';
import User from '@/models/User';

export const runtime = 'nodejs';

function maskPhone(phone = '') {
  const value = String(phone);
  return /^\d{11}$/.test(value) ? `${value.slice(0, 3)}****${value.slice(-4)}` : '匿名用户';
}

export async function GET() {
  await connectToDatabase();
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });

  const settings = await readReferralSettings();
  if (!settings.enabled) return NextResponse.json({ success: true, enabled: false });

  const code = await ensureInviteCode(user._id);
  const invitees = await User.find({ invitedBy: user._id })
    .select('phone createdAt referralRewardedAt')
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  const rewarded = invitees.filter((item) => item.referralRewardedAt);
  return NextResponse.json({
    success: true,
    enabled: true,
    code,
    inviterCredits: settings.inviterCredits,
    inviteeCredits: settings.inviteeCredits,
    maxRewardedInvites: settings.maxRewardedInvites,
    // 已注册但还没绑手机号的那部分要单独讲清楚，否则邀请人会以为奖励没到账
    invitedCount: invitees.length,
    rewardedCount: rewarded.length,
    pendingCount: invitees.length - rewarded.length,
    earnedCredits: rewarded.length * settings.inviterCredits,
    invitees: invitees.map((item) => ({
      email: maskPhone(item.phone),
      joinedAt: item.createdAt,
      rewarded: Boolean(item.referralRewardedAt),
    })),
  });
}
