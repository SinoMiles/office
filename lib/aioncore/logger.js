const PREFIX = '[OfficeWeb:AionChat]';

function summarize(value) {
  if (value == null || typeof value !== 'object') return value;
  const data = value.data;
  return {
    event: value.event || value.name,
    conversation_id: value.conversation_id || data?.conversation_id,
    turn_id: value.turn_id || data?.turn_id,
    msg_id: value.msg_id || data?.msg_id,
    type: value.type || data?.type,
    status: value.status || data?.status,
    state: value.state || data?.state,
    dataKeys: data && typeof data === 'object' ? Object.keys(data).slice(0, 12) : undefined,
  };
}

export function chatLog(stage, message, details) {
  if (details === undefined) console.log(`${PREFIX}[${stage}] ${message}`);
  else console.log(`${PREFIX}[${stage}] ${message}`, summarize(details));
}

export function chatWarn(stage, message, details) {
  if (details === undefined) console.warn(`${PREFIX}[${stage}] ${message}`);
  else console.warn(`${PREFIX}[${stage}] ${message}`, summarize(details));
}

export function chatError(stage, message, error) {
  console.error(`${PREFIX}[${stage}] ${message}`, error instanceof Error ? error.message : summarize(error));
}

