const TERMINAL_STATES = new Set(['completed', 'finished', 'error', 'cancelled', 'idle', 'ai_waiting_input']);
const TERMINAL_TYPES = new Set(['finish', 'error', 'cancelled']);

export function createRuntimeState() {
  return { state: 'idle', isProcessing: false, canSendMessage: true, activeTurnId: null, error: null };
}

export function reduceRuntime(state, eventName, payload = {}) {
  if (eventName === 'realtime.disconnected') return { ...state, state: 'reconnecting' };
  if (eventName === 'realtime.reconnected') return { ...state, state: 'hydrating' };
  if (eventName === 'chat:turn:state') {
    const nextState = payload.state || state.state;
    const terminal = TERMINAL_STATES.has(nextState);
    return {
      ...state,
      state: nextState,
      activeTurnId: payload.turn_id ?? state.activeTurnId,
      isProcessing: !terminal,
      canSendMessage: terminal,
      error: nextState === 'error' ? payload.error || '生成失败' : null,
    };
  }
  if (eventName === 'turn.completed') {
    return {
      ...state,
      state: payload.state || (payload.status === 'error' ? 'error' : 'idle'),
      activeTurnId: payload.turn_id ?? state.activeTurnId,
      isProcessing: false,
      canSendMessage: payload.can_send_message ?? payload.canSendMessage ?? true,
      error: payload.status === 'error' ? payload.error || '生成失败' : null,
    };
  }
  if (eventName === 'local.send') {
    return { ...state, state: 'starting', isProcessing: true, canSendMessage: false, error: null };
  }
  if (eventName === 'message.stream' && isTerminalMessage(payload)) {
    return {
      ...state,
      state: payload.type === 'error' || payload.status === 'error' ? 'error' : 'idle',
      isProcessing: false,
      canSendMessage: true,
      error: payload.type === 'error' ? getErrorText(payload) : null,
    };
  }
  return state;
}

export function isTerminalMessage(message) {
  return TERMINAL_TYPES.has(message?.type) || TERMINAL_STATES.has(message?.status) || message?.data?.type === 'error';
}

function messageKey(message) {
  const callId = message?.data?.call_id || message?.data?.update?.tool_call_id || '';
  return `${message?.msg_id || ''}:${message?.type || ''}:${callId}`;
}

function streamText(message) {
  if (typeof message?.content === 'string') return message.content;
  if (typeof message?.content?.content === 'string') return message.content.content;
  if (typeof message?.content?.description === 'string') return message.content.description;
  if (typeof message?.data === 'string') return message.data;
  if (typeof message?.data?.content === 'string') return message.data.content;
  if (typeof message?.data?.description === 'string') return message.data.description;
  return '';
}

function appendDistinct(previous, incoming, separator = '') {
  if (!incoming || previous.endsWith(incoming)) return previous;
  if (!previous || incoming.startsWith(previous)) return incoming;
  return `${previous}${separator}${incoming}`;
}

export function mergeStreamMessages(messages, incoming) {
  if (!incoming?.msg_id) return messages;
  const index = messages.findIndex((message) => messageKey(message) === messageKey(incoming));
  if (index < 0) return [...messages, incoming];

  const previous = messages[index];
  let merged;
  if (['text', 'thought', 'thinking', 'content'].includes(incoming.type)) {
    const previousText = streamText(previous);
    const nextText = streamText(incoming);
    merged = {
      ...previous,
      ...incoming,
      content: {
        ...(typeof previous.content === 'object' ? previous.content : {}),
        ...(typeof incoming.content === 'object' ? incoming.content : {}),
        content: appendDistinct(previousText, nextText),
      },
    };
  } else if (incoming.type === 'tool_group') {
    const previousTools = Array.isArray(previous.data) ? previous.data : previous.content || [];
    const incomingTools = Array.isArray(incoming.data) ? incoming.data : incoming.content || [];
    const tools = new Map(previousTools.map((tool) => [tool.call_id, tool]));
    for (const tool of incomingTools) tools.set(tool.call_id, { ...tools.get(tool.call_id), ...tool });
    merged = { ...previous, ...incoming, data: [...tools.values()], content: undefined };
  } else {
    merged = { ...previous, ...incoming, data: { ...previous.data, ...incoming.data } };
  }
  const next = [...messages];
  next[index] = merged;
  return next;
}

export function mapMessagesToUi(messages, runtime) {
  const result = [];
  let assistant = null;
  const flush = () => {
    if (assistant) result.push(assistant);
    assistant = null;
  };

  for (const message of messages) {
    if (message.role === 'user') {
      flush();
      result.push({ role: 'user', content: message.content?.content || message.content || '', filename: message.content?.filename });
      continue;
    }
    assistant ||= { role: 'ai', content: '', loading: runtime.isProcessing };
    if (message.type === 'thought' || message.type === 'thinking') {
      const thought = (typeof message.data === 'object' && message.data) || (typeof message.content === 'object' && message.content) || {};
      const description = streamText(message);
      assistant.thought = {
        subject: thought.subject || '思考中',
        description: appendDistinct(assistant.thought?.description || '', description, '\n'),
        done: thought.status === 'done' || isTerminalMessage(message) || !runtime.isProcessing,
      };
    } else if (['tool_group', 'tool_call', 'acp_tool_call'].includes(message.type)) {
      assistant.progress ||= { subject: '正在处理任务', startedAt: message.created_at || message.timestamp || 0, steps: [] };
      const candidates = message.type === 'tool_group'
        ? (Array.isArray(message.data) ? message.data : message.content || [])
        : [message.data || message.content || {}];
      for (const tool of candidates) {
        const update = tool.update || tool;
        const id = tool.call_id || update.tool_call_id;
        const step = {
          id,
          title: tool.description || tool.name || (update.server_name ? `调用 ${update.server_name} 插件` : '执行插件任务'),
          status: ['Success', 'completed'].includes(tool.status || update.status) ? 'completed' : ['Error', 'error'].includes(tool.status || update.status) ? 'failed' : 'running',
        };
        const existing = assistant.progress.steps.findIndex((item) => item.id === id);
        if (existing >= 0) assistant.progress.steps[existing] = step;
        else assistant.progress.steps.push(step);
      }
      assistant.progress.done = !runtime.isProcessing || assistant.progress.steps.every((step) => step.status !== 'running');
    } else if (['text', 'content'].includes(message.type)) {
      assistant.content = streamText(message);
    } else if (message.type === 'permission' || message.type === 'acp_permission') {
      assistant.permission = message;
    } else if (message.type === 'error' || (message.type === 'tips' && message.status === 'error')) {
      assistant.content = `[系统提示] 发生错误: ${getErrorText(message)}`;
      assistant.error = true;
      assistant.loading = false;
    }
  }
  flush();
  return result;
}

function getErrorText(message) {
  return message?.data?.detail || message?.data?.message || message?.data?.content || message?.content?.content || '未知错误';
}
