import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createRuntimeState,
  mapMessagesToUi,
  mergeStreamMessages,
  normalizeHistoryMessages,
  reduceRuntime,
  sanitizeAssistantText,
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

test('stream events retain the active turn required by AionCore cancellation', () => {
  const running = reduceRuntime(createRuntimeState(), 'message.stream', { type: 'content', turn_id: 'turn-live' });
  assert.equal(running.activeTurnId, 'turn-live');
  assert.equal(running.isProcessing, true);
  const cancelling = reduceRuntime(running, 'local.cancel', { turn_id: 'turn-live' });
  assert.equal(cancelling.state, 'cancelling');
  const retryable = reduceRuntime(cancelling, 'local.cancel.failed', { error: '网络异常' });
  assert.equal(retryable.state, 'running');
  assert.equal(retryable.isProcessing, true);
  const finished = reduceRuntime(cancelling, 'message.stream', { type: 'cancelled', turn_id: 'turn-live' });
  assert.equal(finished.activeTurnId, null);
  assert.equal(finished.isProcessing, false);
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

test('thinking, tools and text retain their original timeline order', () => {
  const messages = [
    { msg_id: 'think-1', type: 'thinking', data: { content: '先规划', status: 'done' } },
    { msg_id: 'text-1', type: 'text', content: { content: '开始生成第一页。' } },
    { msg_id: 'tool-1', type: 'acp_tool_call', data: { update: { tool_call_id: 'call-1', title: 'ExecCommand', status: 'completed' } } },
    { msg_id: 'text-2', type: 'text', content: { content: '第1步：封面页' } },
  ];
  const [assistant] = mapMessagesToUi(messages, { isProcessing: false });
  assert.deepEqual(assistant.blocks.map((block) => block.type), ['thinking', 'text', 'tools', 'text']);
  assert.equal(assistant.blocks[2].steps[0].title, 'ExecCommand');
  assert.equal(assistant.content, '开始生成第一页。\n\n第1步：封面页');
});

test('plans, notices and canceled tools remain visible and terminal', () => {
  const messages = [
    { msg_id: 'plan-1', type: 'plan', content: { entries: [{ content: '生成封面', status: 'completed' }] } },
    { msg_id: 'status-1', type: 'agent_status', content: { status: 'connected', message: '工作区已连接' } },
    { msg_id: 'tool-1', type: 'tool_call', content: { call_id: 'call-1', name: 'ExecCommand', status: 'canceled' } },
    { msg_id: 'tip-1', type: 'tips', content: { type: 'warning', content: '部分内容未生成' } },
  ];
  const [assistant] = mapMessagesToUi(messages, { isProcessing: false });
  assert.deepEqual(assistant.blocks.map((block) => block.type), ['plan', 'status', 'tools', 'tip']);
  assert.equal(assistant.blocks[2].steps[0].status, 'canceled');
});

test('server workspace paths never reach user-visible assistant text', () => {
  const input = 'PPT 已成功生成！文件路径：\n\n📁 `/Users/miles/Documents/office/2026/07/15/aionrs-temp-1107ea11/年度述职报告.pptx`';
  assert.equal(sanitizeAssistantText(input), 'PPT 已成功生成！');
  const inline = '文件已保存到 /tmp/aionrs-temp-123/report.xlsx，请下载。';
  assert.equal(sanitizeAssistantText(inline), '文件已保存到 report.xlsx，请下载。');
});

test('repeated content events reuse an unchanged runtime state', () => {
  const running = reduceRuntime(createRuntimeState(), 'message.stream', { type: 'content', turn_id: 'turn-1' });
  const repeated = reduceRuntime(running, 'message.stream', { type: 'content', turn_id: 'turn-1' });
  assert.strictEqual(repeated, running);
});

test('user messages preserve every uploaded filename', () => {
  const [user] = mapMessagesToUi([{
    role: 'user',
    content: { content: '分析这些文件' },
    files: ['D:\\uploads\\report.xlsx', '/uploads/brief.docx'],
  }], { isProcessing: false });
  assert.deepEqual(user.filenames, ['report.xlsx', 'brief.docx']);
});

test('internal document engine branding and installation probes never reach the UI', () => {
  assert.equal(sanitizeAssistantText('我先确认 officecli 是否安装，然后开始创建 PPT。'), '然后开始创建 PPT。');
  assert.equal(sanitizeAssistantText('使用 Office CLI 创建并验证文件。'), '使用 OfficeGPT 创建并验证文件。');
  const [assistant] = mapMessagesToUi([
    { msg_id: 'thinking-brand', type: 'thinking', content: { description: '检查 officecli 是否可用。' } },
    { msg_id: 'text-brand', type: 'text', content: { content: 'OfficeCLI 已完成文件生成。' } },
  ], { isProcessing: false });
  assert.doesNotMatch(JSON.stringify(assistant), /office\s*cli/i);
  assert.match(assistant.content, /OfficeGPT/);
});

test('internal DSML tool protocol never reaches assistant text', () => {
  const leaked = '现在开始生成： < | | DSML | | tool_calls> < | | DSML | | invoke name="ExecCommand"> < | | DSML | | parameter name="cmd" string="true">rm -f "成绩统计表.xlsx"</ | | DSML | | parameter></ | | DSML | | invoke></ | | DSML | | tool_calls>';
  assert.equal(sanitizeAssistantText(leaked), '现在开始生成：');
  assert.equal(sanitizeAssistantText('准备文件\n< | | DSML | | invoke name="ExecCommand">'), '准备文件');
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
