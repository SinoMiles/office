import assert from 'node:assert/strict';
import test from 'node:test';
import crypto from 'node:crypto';

import { createAioncoreBridgeToken } from '../lib/aioncore/bridge-auth.js';

test('bridge token is signed and bound to one safe user id', () => {
  const previous = process.env.OFFICEGPT_CORE_SHARED_SECRET;
  process.env.OFFICEGPT_CORE_SHARED_SECRET = 'commercial-bridge-secret-at-least-32-bytes';
  try {
    const userId = 'user_123';
    const encoded = Buffer.from(userId).toString('base64url');
    const signature = crypto
      .createHmac('sha256', process.env.OFFICEGPT_CORE_SHARED_SECRET)
      .update(userId)
      .digest('hex');
    assert.equal(createAioncoreBridgeToken(userId), `officegpt.${encoded}.${signature}`);
    assert.throws(() => createAioncoreBridgeToken('../other-user'), /INVALID_AIONCORE_USER_ID/);
  } finally {
    if (previous === undefined) delete process.env.OFFICEGPT_CORE_SHARED_SECRET;
    else process.env.OFFICEGPT_CORE_SHARED_SECRET = previous;
  }
});
