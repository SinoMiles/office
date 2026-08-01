import assert from 'node:assert/strict';
import test from 'node:test';

import { movedTowardHistory, resolveFollowLatest } from '../lib/chat/scroll-policy.js';

test('scrolling upward pauses automatic following immediately', () => {
  assert.equal(movedTowardHistory(900, 850), true);
  assert.equal(resolveFollowLatest({ following: true, distanceFromBottom: 50, movedTowardHistory: true }), false);
});

test('stream growth and downward scrolling keep following until user leaves the bottom', () => {
  assert.equal(movedTowardHistory(850, 900), false);
  assert.equal(resolveFollowLatest({ following: true, distanceFromBottom: 50, movedTowardHistory: false }), true);
  assert.equal(resolveFollowLatest({ following: true, distanceFromBottom: 240, movedTowardHistory: false }), false);
});

test('following resumes only when the viewport returns very close to the bottom', () => {
  assert.equal(resolveFollowLatest({ following: false, distanceFromBottom: 80, movedTowardHistory: false }), false);
  assert.equal(resolveFollowLatest({ following: false, distanceFromBottom: 20, movedTowardHistory: false }), true);
});
