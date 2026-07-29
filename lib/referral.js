import crypto from 'node:crypto';

// 邀请规则的纯逻辑部分。单独成文件是为了能被 node --test 直接导入 ——
// 带 'server-only' 的模块在测试里 import 不进来。

export const REFERRAL_DEFAULTS = {
  enabled: true,
  inviterCredits: 5000,
  inviteeCredits: 2000,
  // 每个邀请人最多能拿几次奖励。0 表示不限，但默认给一个上限：
  // 邀请是拉新手段，不该变成可以无限刷的额度来源。
  maxRewardedInvites: 20,
};

function positiveInteger(value, fallback, { min = 0, max = 1_000_000 } = {}) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function normalizeReferralSettings(raw = {}) {
  return {
    enabled: raw.enabled !== false,
    inviterCredits: positiveInteger(raw.inviterCredits, REFERRAL_DEFAULTS.inviterCredits),
    inviteeCredits: positiveInteger(raw.inviteeCredits, REFERRAL_DEFAULTS.inviteeCredits),
    maxRewardedInvites: positiveInteger(raw.maxRewardedInvites, REFERRAL_DEFAULTS.maxRewardedInvites, { max: 10_000 }),
  };
}

// 去掉了 0/O/1/I/L 这几个手抄时会认错的字符 —— 邀请码是要被人念出来、
// 打在聊天框里的，不是只在链接里传递。
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export function generateInviteCode(length = 8) {
  return Array.from({ length }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join('');
}

export function normalizeInviteCode(value) {
  const cleaned = String(value || '').trim().toUpperCase().replace(/[^0-9A-Z]/g, '');
  return cleaned.length >= 6 && cleaned.length <= 12 ? cleaned : '';
}

// 一次邀请能不能兑现，取决于四件事，缺一不可。分成一个纯函数是因为
// 这段判断在绑定手机号和后台补发两个地方都要用，且必须给出同样的结论。
export function evaluateReferralReward({ settings, inviter, invitee, rewardedCount }) {
  if (!settings.enabled) return { granted: false, reason: 'disabled' };
  if (!inviter || !invitee) return { granted: false, reason: 'missing_party' };
  if (String(inviter._id) === String(invitee._id)) return { granted: false, reason: 'self_invite' };
  if (invitee.referralRewardedAt) return { granted: false, reason: 'already_rewarded' };
  if (settings.maxRewardedInvites > 0 && rewardedCount >= settings.maxRewardedInvites) {
    return { granted: false, reason: 'inviter_cap_reached' };
  }
  return {
    granted: true,
    inviterCredits: settings.inviterCredits,
    inviteeCredits: settings.inviteeCredits,
  };
}
