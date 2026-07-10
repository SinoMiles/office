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
Never output shell commands or OfficeCLI code blocks. The tool is the only document execution path.
Build polished, complete documents with clear hierarchy and practical content. For PPT, use intentional layout, spacing, contrast, editable shapes, and charts/tables when useful.
If the user only asks for advice or an outline, answer normally without calling the tool.
After a successful tool call, summarize what was created and tell the user that preview and download are ready.`;

async function callDeepSeek({ apiKey, baseUrl, model, messages, tools }) {
  const response = await fetch(`${String(baseUrl || 'https://api.deepseek.com').replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, tools, tool_choice: 'auto', stream: false }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`DeepSeek request failed (${response.status}): ${body.slice(0, 500)}`);
  }
  const payload = await response.json();
  return { message: payload.choices?.[0]?.message, usage: payload.usage };
}

export async function runOfficeAgent({ apiKey, baseUrl, model, prompt, documentContext, taskDir }) {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...(documentContext ? [{ role: 'system', content: `Uploaded document context:\n${documentContext}` }] : []),
    { role: 'user', content: prompt },
  ];
  let artifact = null;
  let totalTokens = 0;

  for (let turn = 0; turn < 4; turn += 1) {
    const { message, usage } = await callDeepSeek({ apiKey, baseUrl, model, messages, tools: [OFFICE_TOOL] });
    totalTokens += usage?.total_tokens || 0;
    if (!message) throw new Error('DeepSeek returned no assistant message');
    messages.push(message);

    const calls = message.tool_calls || [];
    if (calls.length === 0) {
      return { text: message.content || '处理完成。', artifact, totalTokens };
    }

    for (const call of calls) {
      if (call.function?.name !== 'create_office_document') {
        messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify({ success: false, error: 'Unknown tool' }) });
        continue;
      }
      try {
        const args = JSON.parse(call.function.arguments);
        artifact = await executeOfficePlan({ taskDir, ...args });
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify({ success: true, filename: artifact.filename, operationCount: artifact.operationCount }),
        });
      } catch (error) {
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }),
        });
      }
    }
  }
  throw new Error('The agent exceeded the maximum tool-call turns');
}

