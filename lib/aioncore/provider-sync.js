import 'server-only';
import { getAioncoreBaseUrl } from './config';
import SystemSetting from '@/models/SystemSetting';
import { aioncoreHeaders } from './bridge-auth';

const DEFAULT_BASE_URL = 'https://api.deepseek.com';
const DEFAULT_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';

/**
 * 把 SystemSetting 里的 LLM 配置推到 AionCore 的 providers。
 *
 * 之所以要能独立重放：AionCore 的 provider 存在它自己的 SQLite
 * (storage/aioncore-data/aionui-backend.db)，而配置的真源在 Mongo。
 * 换机器、重建容器或清掉 storage 之后，AionCore 侧的 provider 会消失，
 * 但 Mongo 里的配置还在 —— 此前只有管理员再点一次「保存」才会重新同步，
 * 于是聊天静默失效（AionCore 报 Provider '' not found），而设置页看起来一切正常。
 */
export async function syncLlmProviderToAioncore(llmValue) {
  const apiKey = llmValue?.apiKey || '';
  if (!apiKey) return { synced: false, reason: 'no_api_key' };

  const baseUrl = llmValue.baseUrl || DEFAULT_BASE_URL;
  const model = llmValue.model || DEFAULT_MODEL;
  const aioncore = getAioncoreBaseUrl();
  const authHeaders = (initial = {}) => aioncoreHeaders('system_default_user', initial);

  let providerId = 'deepseek';
  let method = 'POST';
  let endpoint = `${aioncore}/api/providers`;
  try {
    const existingRes = await fetch(`${aioncore}/api/providers`, { headers: authHeaders(), signal: AbortSignal.timeout(5000) });
    if (existingRes.ok) {
      const payload = await existingRes.json();
      const existing = Array.isArray(payload?.data) ? payload.data.find((item) => item.platform === 'deepseek') : null;
      if (existing) {
        providerId = existing.id;
        method = 'PUT';
        endpoint = `${aioncore}/api/providers/${providerId}`;
      }
    }
  } catch (error) {
    return { synced: false, reason: 'aioncore_unreachable', error: error.message };
  }

  const response = await fetch(endpoint, {
    method,
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      id: providerId,
      platform: 'deepseek',
      name: 'DeepSeek',
      base_url: baseUrl,
      api_key: apiKey,
      models: [model],
      enabled: true,
      capabilities: [{ type: 'text' }, { type: 'function_calling' }, { type: 'vision' }],
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    const detail = (await response.text().catch(() => '')).slice(0, 300);
    console.error(`[aioncore] provider ${method} ${endpoint} 失败:`, detail);
    return { synced: false, reason: 'rejected', status: response.status, detail };
  }
  return { synced: true, method, providerId, model };
}

/**
 * 从数据库读取配置并同步。启动时调用，保证 AionCore 与真源一致。
 */
export async function syncLlmProviderFromSettings() {
  const setting = await SystemSetting.findOne({ key: 'llm' }).lean();
  if (!setting?.value) return { synced: false, reason: 'not_configured' };
  return syncLlmProviderToAioncore(setting.value);
}
