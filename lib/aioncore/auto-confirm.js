const PREFERRED_KEYS = [
  'proceed_once',
  'allow_once',
  'allow',
  'yes',
  'proceed_always',
  'proceed_always_tool',
  'proceed_always_server',
  'allow_always',
];
const DENY_KEYS = new Set(['deny', 'cancel', 'reject', 'no']);

function optionKey(option) {
  return String(option?.value ?? option?.option_id ?? option?.id ?? '');
}

export function buildAutoConfirmation(message) {
  const content = message?.data || message?.content || {};
  const callId = content.call_id || content.tool_call?.tool_call_id || content.tool_call_id;
  const options = Array.isArray(content.options) ? content.options : [];
  const keys = options.map(optionKey).filter(Boolean);
  const selected = PREFERRED_KEYS.find((key) => keys.includes(key)) || keys.find((key) => !DENY_KEYS.has(key));
  if (!message?.conversation_id || !message?.msg_id || !callId || !selected) return null;

  const isLegacyConfirmation = options.some((option) => option && Object.hasOwn(option, 'value'));
  return {
    conversationId: message.conversation_id,
    msgId: message.msg_id,
    callId,
    selected,
    body: {
      msg_id: message.msg_id,
      data: isLegacyConfirmation ? { value: selected } : selected,
      // Auto-approval is intentionally scoped to this single request. The
      // client will approve future prompts individually without weakening the
      // backend's persistent permission policy.
      always_allow: false,
    },
  };
}

export async function autoConfirmPermission(message, fetchImpl = fetch) {
  const confirmation = buildAutoConfirmation(message);
  if (!confirmation) throw new Error('权限事件缺少 conversation_id、msg_id、call_id 或可批准选项');
  const response = await fetchImpl(
    `/api/aioncore/api/conversations/${encodeURIComponent(confirmation.conversationId)}/confirmations/${encodeURIComponent(confirmation.callId)}/confirm`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(confirmation.body),
    },
  );
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`自动授权失败 (${response.status})${detail ? `: ${detail.slice(0, 200)}` : ''}`);
  }
  return confirmation;
}

export async function listPendingPermissions(conversationId, fetchImpl = fetch) {
  const response = await fetchImpl(
    `/api/aioncore/api/conversations/${encodeURIComponent(conversationId)}/confirmations`,
    { cache: 'no-store' },
  );
  if (!response.ok) throw new Error(`读取待授权操作失败 (${response.status})`);
  const payload = await response.json();
  const confirmations = Array.isArray(payload) ? payload : payload?.data;
  if (!Array.isArray(confirmations)) return [];
  return confirmations.map((confirmation) => ({
    type: 'permission',
    conversation_id: conversationId,
    msg_id: `confirmation:${confirmation.id}`,
    data: confirmation,
  }));
}
