import assert from 'node:assert/strict';
import test from 'node:test';
import { REMINDER_MILESTONES, reminderMilestoneFor } from '../lib/billing/reminder-schedule.js';

test('picks the tightest milestone rather than the first one that fits', () => {
  // 回归用例：曾经按降序 [7,3,1] 查找，剩 2 天会错误命中 7 天档。
  assert.equal(reminderMilestoneFor(2), 3);
  assert.equal(reminderMilestoneFor(1), 1);
  assert.equal(reminderMilestoneFor(3), 3);
  assert.equal(reminderMilestoneFor(4), 7);
  assert.equal(reminderMilestoneFor(7), 7);
});

test('stays silent outside the reminder window', () => {
  assert.equal(reminderMilestoneFor(8), null);
  assert.equal(reminderMilestoneFor(30), null);
  assert.equal(reminderMilestoneFor(0), null);
  assert.equal(reminderMilestoneFor(-1), null);
  assert.equal(reminderMilestoneFor(Number.NaN), null);
});

test('a subscription walking down to expiry hits every milestone exactly once', () => {
  const sent = new Set();
  // 逐天逼近到期日，模拟调度器每天扫描一次
  for (const daysLeft of [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]) {
    const milestone = reminderMilestoneFor(daysLeft);
    if (milestone) sent.add(milestone);
  }
  assert.deepEqual([...sent].sort((left, right) => left - right), [1, 3, 7]);
});

test('milestones stay ascending so the lookup keeps working', () => {
  assert.deepEqual(REMINDER_MILESTONES, [...REMINDER_MILESTONES].sort((left, right) => left - right));
});
