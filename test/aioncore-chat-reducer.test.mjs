import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createRuntimeState,
  mapMessagesToUi,
  mergeStreamMessages,
  normalizeHistoryMessages,
  reduceRuntime,
  sliceHistoryThroughPrompts,
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

test('finish without a message id is still a terminal runtime event', () => {
  const started = reduceRuntime(createRuntimeState(), 'local.send');
  const completed = reduceRuntime(started, 'message.stream', { type: 'finish' });
  assert.equal(completed.isProcessing, false);
});

test('turn.completed releases processing using the canonical AionUi event', () => {
  const started = reduceRuntime(createRuntimeState(), 'local.send');
  const completed = reduceRuntime(started, 'turn.completed', {
    status: 'finished',
    state: 'ai_waiting_input',
    can_send_message: true,
  });
  assert.equal(completed.state, 'ai_waiting_input');
  assert.equal(completed.isProcessing, false);
  assert.equal(completed.canSendMessage, true);
});

test('AionUi thought and data payload shapes map to the existing UI shell', () => {
  const raw = [
    { msg_id: 'thought', type: 'thought', data: { subject: '分析', description: '正在判断' } },
    { msg_id: 'answer', type: 'content', data: '完成' },
  ];
  const ui = mapMessagesToUi(raw, { isProcessing: false });
  assert.equal(ui[0].thought.description, '正在判断');
  assert.equal(ui[0].content, '完成');
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

test('thought chunks stored in data accumulate into one visible paragraph', () => {
  const runtime = { isProcessing: true };
  const first = { role: 'assistant', msg_id: 'thought-1', type: 'thought', data: { subject: '分析', description: '正在' } };
  const second = { role: 'assistant', msg_id: 'thought-1', type: 'thought', data: { subject: '分析', description: '读取资料' } };
  const merged = mergeStreamMessages(mergeStreamMessages([], first), second);
  const ui = mapMessagesToUi(merged, runtime);
  assert.equal(ui[0].thought.description, '正在读取资料');
});

test('separate thought messages remain visible instead of replacing each other', () => {
  const raw = [
    { role: 'assistant', msg_id: 'thought-1', type: 'thought', data: { subject: '分析', description: '先理解需求。' } },
    { role: 'assistant', msg_id: 'thought-2', type: 'thought', data: { subject: '规划', description: '再制定方案。' } },
  ];
  const ui = mapMessagesToUi(raw, { isProcessing: true });
  assert.equal(ui[0].thought.description, '先理解需求。\n再制定方案。');
  assert.equal(ui[0].thought.subject, '规划');
});

test('AionCore HTTP history positions normalize into user and assistant roles', () => {
  const normalized = normalizeHistoryMessages([
    { msg_id: 'user', position: 'right', type: 'text', content: { content: '问题' } },
    { msg_id: 'hidden', position: 'left', type: 'text', hidden: true, content: { content: '内部内容' } },
    { msg_id: 'assistant', position: 'left', type: 'text', content: { content: '回答' } },
  ]);
  const ui = mapMessagesToUi(normalized, { isProcessing: false });
  assert.deepEqual(ui.map((message) => [message.role, message.content]), [['user', '问题'], ['ai', '回答']]);
});

test('history selection stops before the next turn in a shared AionCore conversation', () => {
  const history = normalizeHistoryMessages([
    { msg_id: 'u1', position: 'right', type: 'text', content: { content: '第一问' } },
    { msg_id: 'a1', position: 'left', type: 'text', content: { content: '第一答' } },
    { msg_id: 'u2', position: 'right', type: 'text', content: { content: '第二问' } },
    { msg_id: 'a2', position: 'left', type: 'text', content: { content: '第二答' } },
  ]);
  const firstTurn = sliceHistoryThroughPrompts(history, ['第一问']);
  assert.deepEqual(firstTurn.map((message) => message.msg_id), ['u1', 'a1']);
  const secondTurn = sliceHistoryThroughPrompts(history, ['第一问', '第二问']);
  assert.deepEqual(secondTurn.map((message) => message.msg_id), ['u1', 'a1', 'u2', 'a2']);
});
