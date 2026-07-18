import assert from 'node:assert/strict';
import test from 'node:test';
import { publicErrorMessage } from '../lib/aioncore/public-error.js';

test('internal engine names never appear in user-facing errors', () => {
  assert.equal(publicErrorMessage(new Error('启动 AionCore 推理失败')), '启动 OfficeGPT 推理失败');
  assert.equal(publicErrorMessage('officecli unavailable'), 'OfficeGPT unavailable');
});
