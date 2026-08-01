import 'server-only';
import BillingRecord from '@/models/BillingRecord';
import SystemSetting from '@/models/SystemSetting';
import User from '@/models/User';
import { evaluateReferralReward, generateInviteCode, normalizeReferralSettings } from '@/lib/referral';

export async function readReferralSettings() {
  const stored = await SystemSetting.findOne({ key: 'referral' }).lean();
  return normalizeReferralSettings(stored?.value || {});
}

// 邀请码惰性生成：绝大多数账号从不分享，注册时就占号只是白白撑大唯一索引。
// 碰撞概率极低（31^8），但唯一索引仍是权威，冲突就换一个再试。
export async function ensureInviteCode(userId) {
  const existing = await User.findById(userId).select('inviteCode').lean();
  if (existing?.inviteCode) return existing.inviteCode;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateInviteCode();
    try {
      const updated = await User.findOneAndUpdate(
        { _id: userId, inviteCode: { $in: [null, ''] } },
        { $set: { inviteCode: code } },
        { new: true },
      ).select('inviteCode').lean();
      if (updated?.inviteCode) return updated.inviteCode;
      // 条件没命中说明并发的另一次调用已经写进去了，直接读回来
      const current = await User.findById(userId).select('inviteCode').lean();
      if (current?.inviteCode) return current.inviteCode;
    } catch (error) {
      if (error?.code !== 11000) throw error;
    }
  }
  throw new Error('邀请码生成失败，请稍后重试');
}

async function credit(user, amount, description, key) {
  if (amount <= 0) return 0;
  const funded = await User.findByIdAndUpdate(user._id, { $inc: { balance: amount } }, { new: true });
  try {
    await BillingRecord.create({
      userId: user._id,
      type: 'charge',
      amount,
      balanceDelta: amount,
      balanceBefore: funded.balance - amount,
      balanceAfter: funded.balance,
      description,
      idempotencyKey: key,
    });
    return amount;
  } catch (error) {
    // 流水没落上就把余额退回去，账面不能对不上。唯一键冲突说明这笔
    // 已经发过了，属于正常竞态 —— 同样要退，但不算失败。
    await User.findByIdAndUpdate(user._id, { $inc: { balance: -amount } });
    if (error?.code !== 11000) throw error;
    return 0;
  }
}

// 奖励在被邀请人「绑定手机号」时才结算，而不是注册时。注册只要一个邮箱，
// 放在那里等于把刚堵上的薅羊毛口子重新打开一遍。
export async function grantReferralRewards(inviteeId) {
  const invitee = await User.findById(inviteeId);
  if (!invitee?.invitedBy || invitee.referralRewardedAt) return { granted: false, reason: 'not_applicable' };

  const [settings, inviter, rewardedCount] = await Promise.all([
    readReferralSettings(),
    User.findById(invitee.invitedBy),
    User.countDocuments({ invitedBy: invitee.invitedBy, referralRewardedAt: { $ne: null } }),
  ]);

  const decision = evaluateReferralReward({ settings, inviter, invitee, rewardedCount });
  if (!decision.granted) return decision;

  // 先把标记抢下来再发钱：抢不到说明另一路已经在发了，直接退出，
  // 否则并发的两次调用会各发一份。
  const claimed = await User.findOneAndUpdate(
    { _id: invitee._id, referralRewardedAt: null },
    { $set: { referralRewardedAt: new Date() } },
    { new: true },
  );
  if (!claimed) return { granted: false, reason: 'already_rewarded' };

  const inviterGranted = await credit(inviter, decision.inviterCredits, `邀请好友奖励 · ${invitee.phone || invitee.email}`, `referral:inviter:${invitee._id}`);
  const inviteeGranted = await credit(invitee, decision.inviteeCredits, '受邀注册奖励', `referral:invitee:${invitee._id}`);
  return { granted: true, inviterGranted, inviteeGranted, inviterId: inviter._id };
}
