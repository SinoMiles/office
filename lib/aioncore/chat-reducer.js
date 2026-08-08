const TERMINAL_STATES = new Set(['completed', 'finished', 'error', 'cancelled', 'idle', 'ai_waiting_input']);
const TERMINAL_TYPES = new Set(['finish', 'error', 'cancelled']);
const GENERATED_FILE_PATH_PATTERN = /(?:\/(?:[^/\s`()[\]{}]+\/)+|[A-Za-z]:\\(?:[^\\\s`()[\]{}]+\\)+)[^\\/\s`()[\]{}]+\.(?:pptx|docx|xlsx|xls|pdf|csv|md|txt|png|jpe?g|webp)/giu;
const INTERNAL_MICROCOMPACT_PATTERN = /^\s*Microcompact:\s*cleared\s+\d+\s+tool results?\s*\(~?[\d,.]+\s+tokens?\s+freed\)\s*[.!]?\s*$/iu;
const WINDOWS_ABSOLUTE_PATH_PATTERN = /\b[A-Za-z]:\\[^\r\n,，。；;`"'<>|]*/gu;
const UNIX_SERVER_PATH_PATTERN = /\/(?:home|var|tmp|opt|srv|root|Users|private)(?:\/[^\s,，。；;:`"'<>|]+)+/gu;

export function createRuntimeState() {
  return { state: 'idle', isProcessing: false, canSendMessage: true, activeTurnId: null, error: null };
}

export function reduceRuntime(state, eventName, payload = {}) {
  if (eventName === 'realtime.error') {
    return {
      ...state,
      state: 'error',
      activeTurnId: null,
      isProcessing: false,
      canSendMessage: true,
      error: getErrorText(payload) || '生成失败',
    };
  }
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
  if (eventName === 'local.cancel') {
    return { ...state, state: 'cancelling', isProcessing: true, canSendMessage: false, activeTurnId: payload.turn_id ?? state.activeTurnId };
  }
  if (eventName === 'local.cancel.failed') {
    return { ...state, state: 'running', isProcessing: true, canSendMessage: false, error: payload.error || '停止生成失败' };
  }
  if (eventName === 'message.stream') {
    if (isTerminalMessage(payload)) {
      return {
        ...state,
        state: payload.type === 'error' || payload.status === 'error' ? 'error' : 'idle',
        activeTurnId: null,
        isProcessing: false,
        canSendMessage: true,
        error: payload.type === 'error' ? getErrorText(payload) : null,
      };
    }
    const nextState = state.state === 'idle' ? 'running' : state.state;
    const nextTurnId = payload.turn_id ?? state.activeTurnId;
    if (state.state === nextState && state.activeTurnId === nextTurnId && state.isProcessing && !state.canSendMessage) return state;
    return {
      ...state,
      state: nextState,
      activeTurnId: nextTurnId,
      isProcessing: true,
      canSendMessage: false,
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

export function mergeHistoryMessages(currentMessages, historyMessages, conversationId) {
  const history = Array.isArray(historyMessages) ? historyMessages : [];
  const historyKeys = new Set(history.map(messageKey));
  const pending = (Array.isArray(currentMessages) ? currentMessages : []).filter((message) => {
    if (conversationId && message?.conversation_id && message.conversation_id !== conversationId) return false;
    if (String(message?.msg_id || '').startsWith('local-user-')) return true;
    return Boolean(message?.conversation_id === conversationId && !historyKeys.has(messageKey(message)));
  });
  return pending.length ? [...history, ...pending] : history;
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

export function sanitizeAssistantText(value = '') {
  const sanitized = [];
  const branded = String(value || '')
    .replace(/@officecli\/sdk/giu, 'OfficeGPT')
    .replace(/\boffice[\s_-]*cli\b/giu, 'OfficeGPT')
    .replace(/<[\s|]*DSML[\s|]*(?:tool_calls|invoke|parameter)[\s\S]*?<\/[\s|]*DSML[\s|]*tool_calls\s*>/giu, '')
    .replace(/<[\s|]*DSML[\s|]*(?:tool_calls|invoke|parameter)[\s\S]*$/giu, '');
  for (const sourceLine of branded.split('\n')) {
    let line = sourceLine;
    if (INTERNAL_MICROCOMPACT_PATTERN.test(line)) continue;
    if (/DSML[\s|]*(?:tool_calls|invoke|parameter)|<\/?(?:invoke|parameter)\b/iu.test(line)) continue;
    const installationProbe = /(?:确认|检查|检测|查看|验证).{0,24}(?:OfficeGPT|命令|工具|文档引擎).{0,20}(?:是否)?(?:已安装|安装|存在|可用|就绪)|(?:whether|if).{0,24}OfficeGPT.{0,20}(?:installed|available)|(?:check|verify|detect).{0,24}(?:installation|availability)/iu;
    if (installationProbe.test(line)) {
      line = line.replace(/(?:让我|我(?:先|将|会)?|先|现在)?(?:确认|检查|检测|查看|验证)[^。！？.!?]*(?:是否)?(?:已安装|安装|存在|可用|就绪)[。！？.!?]?/giu, '')
        .replace(/(?:let me|I(?:'ll| will)?|first)?\s*(?:check|verify|detect)[^.!?]*(?:installed|installation|available|availability)[.!?]?/giu, '')
        .replace(/^[\s,，、;；:：]+/u, '')
        .trim();
      if (!line) continue;
    }
    const paths = [...line.matchAll(GENERATED_FILE_PATH_PATTERN)];
    if (!paths.length) {
      line = line
        .replace(WINDOWS_ABSOLUTE_PATH_PATTERN, 'workspace')
        .replace(UNIX_SERVER_PATH_PATTERN, 'workspace');
      const cleanedLabel = line.replace(/\s*(?:文件|输出|保存)(?:位置|路径)[:：]\s*$/u, '').trimEnd();
      // 空行必须原样保留：Markdown 的段落、列表、表格全靠空行分隔。
      // 这里过去只写 `if (cleanedLabel)`，把「本来就是空行」和「清洗后才变空」
      // 一起丢掉了，于是流式正文被压成一整块没有格式的文字；刷新后读的是
      // AionCore 里的原文，所以反而是有格式的——两边不一致就是这么来的。
      if (cleanedLabel || !line.trim()) sanitized.push(cleanedLabel);
      continue;
    }
    let remainder = line;
    for (const match of paths) remainder = remainder.replace(match[0], '');
    const decorationOnly = remainder.replace(/[\s`*_~()[\]{}<>📁📂🗂️📄🎉✅:：。，、-]/gu, '');
    if (!decorationOnly || /^(?:文件|输出|保存)(?:位置|路径)$/u.test(decorationOnly)) continue;
    let cleaned = line;
    for (const match of paths) cleaned = cleaned.replace(match[0], match[0].split(/[\\/]/).pop());
    sanitized.push(cleaned);
  }
  return sanitized.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function sanitizeVisibleValue(value) {
  if (typeof value === 'string') return sanitizeAssistantText(value);
  if (Array.isArray(value)) return value.map(sanitizeVisibleValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitizeVisibleValue(item)]));
  }
  return value;
}

function normalizeToolStatus(status) {
  const value = String(status || '').toLowerCase();
  if (['success', 'completed', 'done'].includes(value)) return 'completed';
  if (['error', 'failed', 'failure'].includes(value)) return 'failed';
  if (['cancelled', 'canceled'].includes(value)) return 'canceled';
  if (['pending', 'queued'].includes(value)) return 'pending';
  return 'running';
}

export function mergeStreamMessages(messages, incoming) {
  if (!incoming?.msg_id) return messages;
  const key = messageKey(incoming);
  const lastIndex = messages.length - 1;
  const contiguousType = ['text', 'thought', 'thinking', 'content'].includes(incoming.type);
  const index = contiguousType
    ? (messageKey(messages[lastIndex]) === key ? lastIndex : -1)
    : messages.findIndex((message) => messageKey(message) === key);
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
        // AionCore's message.stream contract emits text/thinking as deltas.
        // Concatenate them verbatim: Markdown commonly repeats tiny chunks such
        // as `**`, `---` and `|`. Treating those as duplicate snapshots drops
        // syntax during the live render, while persisted history remains valid.
        content: `${previousText}${nextText}`,
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
      result.push({ role: 'user', content: message.content?.content || message.content || '', filename: message.content?.filename, filenames: message.content?.filenames || message.files?.map((file) => String(file).split(/[\\/]/).pop()), createdAt: message.created_at || message.timestamp });
      continue;
    }
    assistant ||= { role: 'ai', content: '', blocks: [], loading: runtime.isProcessing };
    assistant.createdAt = message.created_at || message.timestamp || assistant.createdAt;
    if (message.type === 'thought' || message.type === 'thinking') {
      const thought = (typeof message.data === 'object' && message.data) || (typeof message.content === 'object' && message.content) || {};
      const description = sanitizeAssistantText(streamText(message));
      const thoughtBlock = {
        type: 'thinking',
        id: `thinking:${message.msg_id || assistant.blocks.length}`,
        subject: sanitizeAssistantText(thought.subject || '思考中'),
        description,
        done: thought.status === 'done' || isTerminalMessage(message) || !runtime.isProcessing,
        duration: thought.duration ?? thought.duration_ms,
      };
      assistant.blocks.push(thoughtBlock);
      assistant.thought = {
        ...thoughtBlock,
        description: appendDistinct(assistant.thought?.description || '', description, '\n'),
      };
    } else if (['tool_group', 'tool_call', 'acp_tool_call'].includes(message.type)) {
      let toolBlock = assistant.blocks.at(-1);
      if (toolBlock?.type !== 'tools') {
        toolBlock = { type: 'tools', id: `tools:${message.msg_id || assistant.blocks.length}`, startedAt: message.created_at || message.timestamp || Date.now(), steps: [] };
        assistant.blocks.push(toolBlock);
      }
      const candidates = message.type === 'tool_group'
        ? (Array.isArray(message.data) ? message.data : message.content || [])
        : [message.data || message.content || {}];
      for (const tool of candidates) {
        const update = tool.update || tool;
        const resultDisplay = tool.result_display || update.result_display || {};
        const id = tool.call_id || update.tool_call_id;
        const step = {
          id,
          title: sanitizeAssistantText(tool.name || update.title || update.kind || tool.description || (update.server_name ? `调用 ${update.server_name} 插件` : '执行文档任务')),
          detail: tool.description && tool.description !== tool.name ? sanitizeAssistantText(tool.description) : undefined,
          input: sanitizeVisibleValue(tool.input || update.raw_input || update.input),
          output: sanitizeVisibleValue(tool.output || update.raw_output || update.output || update.content),
          status: normalizeToolStatus(tool.status || update.status),
        };
        const existing = toolBlock.steps.findIndex((item) => item.id === id);
        if (existing >= 0) toolBlock.steps[existing] = step;
        else toolBlock.steps.push(step);
        if (resultDisplay.file_diff || resultDisplay.file_name) {
          toolBlock.files ||= [];
          const fileName = resultDisplay.file_name || resultDisplay.file_path;
          const fileEntry = { path: resultDisplay.file_path || fileName, name: String(fileName || '').split(/[\\/]/).pop(), diff: resultDisplay.file_diff || '' };
          const fileIndex = toolBlock.files.findIndex((item) => item.path === fileEntry.path);
          if (fileIndex >= 0) toolBlock.files[fileIndex] = fileEntry;
          else toolBlock.files.push(fileEntry);
        }
      }
      toolBlock.done = !runtime.isProcessing || toolBlock.steps.every((step) => step.status !== 'running');
      assistant.progress = { subject: '正在处理任务', ...toolBlock };
    } else if (['text', 'content'].includes(message.type)) {
      const text = sanitizeAssistantText(streamText(message));
      assistant.blocks.push({ type: 'text', id: `text:${message.msg_id || assistant.blocks.length}`, content: text });
      assistant.content = appendDistinct(assistant.content, text, '\n\n');
    } else if (message.type === 'plan') {
      const plan = (typeof message.data === 'object' && message.data) || (typeof message.content === 'object' && message.content) || {};
      assistant.blocks.push({
        type: 'plan',
        id: `plan:${message.msg_id || assistant.blocks.length}`,
        title: sanitizeAssistantText(plan.title || '任务计划'),
        entries: sanitizeVisibleValue(Array.isArray(plan.entries) ? plan.entries : Array.isArray(plan.steps) ? plan.steps : []),
      });
    } else if (message.type === 'agent_status') {
      const status = (typeof message.data === 'object' && message.data) || (typeof message.content === 'object' && message.content) || {};
      assistant.blocks.push({ type: 'status', id: `status:${message.msg_id || assistant.blocks.length}`, status: status.status || message.status, content: sanitizeAssistantText(status.message || status.content || status.description || '') });
    } else if (message.type === 'tips') {
      const tip = (typeof message.data === 'object' && message.data) || (typeof message.content === 'object' && message.content) || {};
      const level = tip.type || message.status || 'info';
      const content = sanitizeAssistantText(tip.message || tip.content || tip.description || streamText(message));
      assistant.blocks.push({ type: 'tip', id: `tip:${message.msg_id || assistant.blocks.length}`, level, content, retryable: Boolean(tip.retryable || tip.error?.retryable) });
      if (level === 'error') {
        assistant.content = content || assistant.content;
        assistant.error = true;
      }
    } else if (message.type === 'permission' || message.type === 'acp_permission') {
      assistant.permission = message;
    } else if (message.type === 'error') {
      assistant.content = `[系统提示] 发生错误: ${sanitizeAssistantText(getErrorText(message))}`;
      assistant.error = true;
      assistant.loading = false;
    }
  }
  flush();
  return result;
}

export function normalizeHistoryMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((message) => message && !message.hidden)
    .map((message) => ({
      ...message,
      role: message.role || (message.position === 'right' ? 'user' : 'assistant'),
    }));
}

export function sliceHistoryThroughPrompts(messages, prompts) {
  if (!Array.isArray(messages) || !Array.isArray(prompts) || prompts.length === 0) return messages || [];
  let searchFrom = 0;
  let end = messages.length;
  for (const prompt of prompts) {
    const expected = String(prompt || '').trim();
    const userIndex = messages.findIndex((message, index) =>
      index >= searchFrom && message.role === 'user' && visibleUserPrompt(message) === expected
    );
    if (userIndex < 0) continue;
    searchFrom = userIndex + 1;
    const nextUserIndex = messages.findIndex((message, index) => index >= searchFrom && message.role === 'user');
    end = nextUserIndex < 0 ? messages.length : nextUserIndex;
    searchFrom = end;
  }
  return messages.slice(0, end);
}

function visibleUserPrompt(message) {
  return streamText(message)
    .replace(/\s*\[\[AION_FILES\]\][\s\S]*$/u, '')
    .trim();
}

function getErrorText(message) {
  return message?.error || message?.message || message?.detail || message?.data?.detail || message?.data?.message || message?.data?.content || message?.content?.content || '未知错误';
}
