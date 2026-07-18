import path from 'node:path';
import { readFile } from 'node:fs/promises';

function tokenCount(value) {
  const count = Number(value || 0);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

export async function readConversationUsage(conversationId) {
  if (!/^[a-zA-Z0-9_-]+$/.test(conversationId || '')) return null;
  const projectRoot = process.cwd();
  const dataDir = process.env.AIONCORE_DATA_DIR || path.join(projectRoot, 'storage', 'aioncore-data');
  const statePath = path.join(dataDir, 'aionrs-sessions', 'sessions', conversationId, 'state.json');
  try {
    const state = JSON.parse(await readFile(statePath, 'utf8'));
    const usage = state?.total_usage;
    if (!usage || typeof usage !== 'object') return null;
    return {
      input_tokens: tokenCount(usage.input_tokens),
      output_tokens: tokenCount(usage.output_tokens),
      cache_read_tokens: tokenCount(usage.cache_read_tokens),
      cache_write_tokens: tokenCount(usage.cache_creation_tokens),
    };
  } catch {
    return null;
  }
}

export function subtractUsage(total, settledTasks) {
  if (!total) return null;
  const settled = (settledTasks || []).reduce((sum, task) => ({
    input_tokens: sum.input_tokens + tokenCount(task.billing?.usage?.inputTokens),
    output_tokens: sum.output_tokens + tokenCount(task.billing?.usage?.outputTokens),
    cache_read_tokens: sum.cache_read_tokens + tokenCount(task.billing?.usage?.cachedInputTokens),
    cache_write_tokens: sum.cache_write_tokens,
  }), { input_tokens: 0, output_tokens: 0, cache_read_tokens: 0, cache_write_tokens: 0 });
  return {
    input_tokens: Math.max(0, total.input_tokens - settled.input_tokens),
    output_tokens: Math.max(0, total.output_tokens - settled.output_tokens),
    cache_read_tokens: Math.max(0, total.cache_read_tokens - settled.cache_read_tokens),
    cache_write_tokens: Math.max(0, total.cache_write_tokens - settled.cache_write_tokens),
  };
}
