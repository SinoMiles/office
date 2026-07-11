import { executeOfficePlan } from '@/lib/office/executor';

const OFFICE_TOOL = {
  type: 'function',
  function: {
    name: 'create_office_document',
    description: 'Create a real editable PowerPoint, Word, or Excel file and render a faithful HTML preview.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['format', 'filename', 'operations'],
      properties: {
        format: { type: 'string', enum: ['pptx', 'docx', 'xlsx'] },
        filename: { type: 'string' },
        operations: {
          type: 'array',
          minItems: 1,
          maxItems: 300,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['command', 'path'],
            properties: {
              command: { type: 'string', enum: ['add', 'set', 'remove', 'get', 'query', 'view'] },
              path: { type: 'string' },
              args: { type: 'object', additionalProperties: { type: ['string', 'number', 'boolean'] } },
              props: { type: 'object', additionalProperties: { type: ['string', 'number', 'boolean'] } },
            },
          },
        },
      },
    },
  },
};

const SYSTEM_PROMPT = `You are OfficeGPT, a production office-document agent.
Use create_office_document whenever the user asks to create/export an editable PPTX, DOCX, or XLSX.
Never output shell commands or internal script code blocks. The tool is the only document execution path.
Build polished, complete documents with clear hierarchy and practical content. For PPT, use intentional layout, spacing, contrast, editable shapes, and charts/tables when useful.
If the user only asks for advice or an outline, answer normally without calling the tool.
After a successful tool call, summarize what was created and tell the user that preview and download are ready.
Earlier user and assistant messages are the active conversation. Resolve follow-ups such as “生成它”, “继续”, or “修改刚才的报告” from that history; do not ask for content that already appears in the conversation.`;

async function callDeepSeek({ apiKey, baseUrl, model, messages, tools, onTextDelta, onReasoningDelta, signal }) {
  const response = await fetch(`${String(baseUrl || 'https://api.deepseek.com').replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    signal,
    body: JSON.stringify({
      model,
      messages,
      tools,
      tool_choice: 'auto',
      max_tokens: 8192,
      stream: true,
      stream_options: { include_usage: true },
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`DeepSeek request failed (${response.status}): ${body.slice(0, 500)}`);
  }
  if (!response.body) throw new Error('DeepSeek did not return a response stream');

  const decoder = new TextDecoder();
  const message = { role: 'assistant', content: '', tool_calls: [] };
  let usage;
  let buffer = '';
  const consumePacket = (packet) => {
    const rawData = packet.split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .join('\n');
    if (!rawData || rawData === '[DONE]') return;
    const payload = JSON.parse(rawData);
    if (payload.usage) usage = payload.usage;
    const delta = payload.choices?.[0]?.delta;
    if (!delta) return;
    // Reasoner models stream chain-of-thought separately from the answer.
    // Surface it as a "thought" so the UI can show a real thinking panel,
    // matching AionUi which only renders thought when a genuine event exists.
    if (typeof delta.reasoning_content === 'string' && delta.reasoning_content) {
      onReasoningDelta?.(delta.reasoning_content);
    }
    if (typeof delta.content === 'string' && delta.content) {
      message.content += delta.content;
      onTextDelta?.(delta.content);
    }
    for (const fragment of delta.tool_calls || []) {
      const index = fragment.index ?? message.tool_calls.length;
      const call = message.tool_calls[index] || { id: '', type: 'function', function: { name: '', arguments: '' } };
      if (fragment.id) call.id = fragment.id;
      if (fragment.type) call.type = fragment.type;
      if (fragment.function?.name) call.function.name += fragment.function.name;
      if (fragment.function?.arguments) call.function.arguments += fragment.function.arguments;
      message.tool_calls[index] = call;
    }
  };

  const reader = response.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const packets = buffer.split('\n\n');
    buffer = packets.pop() || '';
    packets.forEach(consumePacket);
  }
  if (buffer.trim()) consumePacket(buffer);
  return { message, usage };
}

export async function runOfficeAgent({ apiKey, baseUrl, model, prompt, documentContext, conversationHistory = [], taskDir, sourceArtifact, signal, onEvent = () => {} }) {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...(documentContext ? [{ role: 'system', content: `Uploaded document context:\n${documentContext}` }] : []),
    ...(sourceArtifact ? [{ role: 'system', content: `The user is continuing the editable file ${sourceArtifact.filename}. Apply the requested changes to that existing file; preserve unrelated content and its format.` }] : []),
    ...conversationHistory.flatMap((turn) => {
      const history = [{ role: 'user', content: turn.prompt }];
      if (turn.response) history.push({ role: 'assistant', content: turn.response });
      return history;
    }),
    { role: 'user', content: prompt },
  ];
  let artifact = null;
  let totalTokens = 0;
  let streamedText = false;

  // Throttle thought updates to a readable cadence (mirrors AionUi's 50ms hook
  // throttle, applied server-side so the SSE stream itself stays light).
  let reasoning = '';
  let lastThoughtAt = 0;
  const flushThought = (force) => {
    const now = Date.now();
    if (!force && now - lastThoughtAt < 120) return;
    lastThoughtAt = now;
    onEvent({ type: 'thought', subject: '深度思考中', description: reasoning });
  };

  onEvent({ type: 'start' });

  const { message, usage } = await callDeepSeek({
    apiKey,
    baseUrl,
    model,
    messages,
    tools: [OFFICE_TOOL],
    signal,
    onTextDelta(content) {
      // The first answer token means reasoning is over; settle the thought panel.
      if (reasoning) flushThought(true);
      streamedText = true;
      onEvent({ type: 'content', content });
    },
    onReasoningDelta(chunk) {
      reasoning += chunk;
      flushThought(false);
    },
  });
  if (reasoning) onEvent({ type: 'thought', subject: '已完成思考', description: reasoning, done: true });
  totalTokens += usage?.total_tokens || 0;
  if (!message) throw new Error('DeepSeek returned no assistant message');

  const calls = message.tool_calls || [];
  if (calls.length === 0) {
    return { text: message.content || '处理完成。', artifact, totalTokens, streamedText };
  }

  const call = calls.find((item) => item.function?.name === 'create_office_document');
  if (!call) throw new Error('模型请求了不支持的工具');

  try {
    const args = JSON.parse(call.function.arguments);
    onEvent({
      type: 'tool',
      id: 'officecli',
      title: 'OfficeCLI 正在生成文件',
      detail: `准备执行 ${Array.isArray(args.operations) ? args.operations.length : 0} 项文档操作`,
      status: 'running',
    });
    artifact = await executeOfficePlan({ taskDir, ...args, sourceFile: sourceArtifact?.filePath, onProgress: onEvent, isCancelled: () => signal?.aborted });
    onEvent({ type: 'tool', id: 'officecli', title: 'OfficeCLI 已完成文件生成', status: 'completed' });
    return {
      text: `已生成可编辑文件《${artifact.filename}》，右侧预览与下载已就绪。`,
      artifact,
      totalTokens,
      // Replace any model preamble with the confirmed server-side result.
      streamedText: false,
    };
  } catch (error) {
    const messageText = error instanceof Error ? error.message : String(error);
    onEvent({ type: 'tool', id: 'officecli', title: 'OfficeCLI 生成失败', detail: messageText, status: 'error' });
    throw new Error(`OfficeCLI 未能生成文件：${messageText}`);
  }
}
