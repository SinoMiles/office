import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateReferralReward, generateInviteCode, normalizeInviteCode, normalizeReferralSettings } from '../lib/referral.js';

const settings = normalizeReferralSettings({ inviterCredits: 5000, inviteeCredits: 2000, maxRewardedInvites: 3 });
const alice = { _id: 'a' };
const bob = { _id: 'b' };

test('referral settings fall back and clamp instead of trusting admin input', () => {
  assert.deepEqual(normalizeReferralSettings({}), { enabled: true, inviterCredits: 5000, inviteeCredits: 2000, maxRewardedInvites: 20 });
  assert.equal(normalizeReferralSettings({ inviterCredits: -100 }).inviterCredits, 0);
  assert.equal(normalizeReferralSettings({ inviterCredits: 'abc' }).inviterCredits, 5000);
  assert.equal(normalizeReferralSettings({ maxRewardedInvites: 999999 }).maxRewardedInvites, 10000);
  assert.equal(normalizeReferralSettings({ enabled: false }).enabled, false);
});

test('invite codes avoid the characters people mistype', () => {
  for (let i = 0; i < 200; i += 1) {
    const code = generateInviteCode();
    assert.equal(code.length, 8);
    // 0/O/1/I/L 一律不出现 —— 邀请码是要被人念出来、手抄进输入框的
    assert.doesNotMatch(code, /[01OIL]/, code);
  }
});

test('normalizeInviteCode accepts what users actually paste', () => {
  assert.equal(normalizeInviteCode(' abc-234z '), 'ABC234Z');
  assert.equal(normalizeInviteCode('AB2'), '');            // 太短
  assert.equal(normalizeInviteCode('A'.repeat(13)), '');    // 太长
  assert.equal(normalizeInviteCode(null), '');
});

test('a reward is granted once, for someone else, within the cap', () => {
  assert.equal(evaluateReferralReward({ settings, inviter: alice, invitee: bob, rewardedCount: 0 }).granted, true);
  assert.equal(evaluateReferralReward({ settings, inviter: alice, invitee: alice, rewardedCount: 0 }).reason, 'self_invite');
  assert.equal(evaluateReferralReward({ settings, inviter: alice, invitee: { ...bob, referralRewardedAt: new Date() }, rewardedCount: 0 }).reason, 'already_rewarded');
  assert.equal(evaluateReferralReward({ settings, inviter: alice, invitee: bob, rewardedCount: 3 }).reason, 'inviter_cap_reached');
  assert.equal(evaluateReferralReward({ settings, inviter: null, invitee: bob, rewardedCount: 0 }).reason, 'missing_party');
  assert.equal(evaluateReferralReward({ settings: { ...settings, enabled: false }, inviter: alice, invitee: bob, rewardedCount: 0 }).reason, 'disabled');
});

test('a cap of zero means unlimited, not blocked', () => {
  const uncapped = normalizeReferralSettings({ maxRewardedInvites: 0 });
  assert.equal(evaluateReferralReward({ settings: uncapped, inviter: alice, invitee: bob, rewardedCount: 9999 }).granted, true);
});
