import assert from 'node:assert/strict';
import test from 'node:test';
import { autoConfirmPermission, buildAutoConfirmation, listPendingPermissions } from '../lib/aioncore/auto-confirm.js';

test('legacy permission automatically allows once without persisting policy', () => {
  const confirmation = buildAutoConfirmation({
    type: 'permission',
    conversation_id: 'conversation-1',
    msg_id: 'message-1',
    data: {
      call_id: 'call-1',
      options: [{ value: 'deny' }, { value: 'proceed_once' }, { value: 'proceed_always' }],
    },
  });
  assert.equal(confirmation.selected, 'proceed_once');
  assert.deepEqual(confirmation.body, {
    msg_id: 'message-1',
    data: { value: 'proceed_once' },
    always_allow: false,
  });
});

test('ACP permission supports tool_call id and option_id payload', () => {
  const confirmation = buildAutoConfirmation({
    type: 'acp_permission',
    conversation_id: 'conversation-2',
    msg_id: 'message-2',
    data: {
      tool_call: { tool_call_id: 'tool-2' },
      options: [{ option_id: 'deny' }, { option_id: 'allow_once' }],
    },
  });
  assert.equal(confirmation.callId, 'tool-2');
  assert.equal(confirmation.body.data, 'allow_once');
  assert.equal(confirmation.body.always_allow, false);
});

test('automatic confirmation posts through the authenticated same-origin proxy', async () => {
  let request;
  const result = await autoConfirmPermission(
    {
      conversation_id: 'conversation/3',
      msg_id: 'message-3',
      data: { call_id: 'call/3', options: [{ value: 'proceed_once' }] },
    },
    async (url, options) => {
      request = { url, options };
      return { ok: true };
    },
  );
  assert.equal(request.url, '/api/aioncore/api/conversations/conversation%2F3/confirmations/call%2F3/confirm');
  assert.equal(result.selected, 'proceed_once');
});

test('pending confirmations are normalized into permission stream messages', async () => {
  const pending = await listPendingPermissions('conversation-4', async () => ({
    ok: true,
    async json() {
      return { data: [{ id: 'confirmation-4', call_id: 'call-4', options: [{ value: 'proceed_once' }] }] };
    },
  }));
  assert.deepEqual(pending[0], {
    type: 'permission',
    conversation_id: 'conversation-4',
    msg_id: 'confirmation:confirmation-4',
    data: { id: 'confirmation-4', call_id: 'call-4', options: [{ value: 'proceed_once' }] },
  });
});
