import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createRuntimeState,
  mapMessagesToUi,
  mergeStreamMessages,
  reduceRuntime,
} from '../lib/aioncore/chat-reducer.js';

test('text stream chunks merge by message identity', () => {
  const first = { msg_id: 'm1', type: 'text', content: { content: '你' } };
  const second = { msg_id: 'm1', type: 'text', content: { content: '好' } };
  const messages = mergeStreamMessages(mergeStreamMessages([], first), second);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].content.content, '你好');
});

test('tool calls with different call ids remain independent', () => {
  const first = { msg_id: 'm1', type: 'tool_call', data: { call_id: 'a', status: 'running' } };
  const second = { msg_id: 'm1', type: 'tool_call', data: { call_id: 'b', status: 'running' } };
  const messages = mergeStreamMessages(mergeStreamMessages([], first), second);
  assert.equal(messages.length, 2);
});

test('runtime starts optimistically and releases on terminal stream event', () => {
  const started = reduceRuntime(createRuntimeState(), 'local.send');
  assert.equal(started.isProcessing, true);
  assert.equal(started.canSendMessage, false);
  const completed = reduceRuntime(started, 'message.stream', { type: 'finish', status: 'finished' });
  assert.equal(completed.isProcessing, false);
  assert.equal(completed.canSendMessage, true);
});

test('UI mapping preserves thinking and deduplicates tool steps', () => {
  const raw = [
    { role: 'assistant', msg_id: 'thought', type: 'thinking', content: { subject: '分析', content: '处理中' } },
    { role: 'assistant', msg_id: 'tools', type: 'tool_call', data: { call_id: 'call-1', name: '读取', status: 'running' } },
    { role: 'assistant', msg_id: 'tools', type: 'tool_call', data: { call_id: 'call-1', name: '读取', status: 'completed' } },
  ];
  const ui = mapMessagesToUi(raw, { isProcessing: false });
  assert.equal(ui[0].thought.subject, '分析');
  assert.equal(ui[0].progress.steps.length, 1);
  assert.equal(ui[0].progress.steps[0].status, 'completed');
});

