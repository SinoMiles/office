import assert from 'node:assert/strict';
import test from 'node:test';
import { cancelTaskRuntime, finishTaskRuntime, startTaskRuntime } from '../lib/task-runtime.js';

test('a registered task can be cancelled exactly while it is active', () => {
  const controller = startTaskRuntime('task-a');
  assert.equal(controller.signal.aborted, false);
  assert.equal(cancelTaskRuntime('task-a'), true);
  assert.equal(controller.signal.aborted, true);
  finishTaskRuntime('task-a');
  assert.equal(cancelTaskRuntime('task-a'), false);
});
