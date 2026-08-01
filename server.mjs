import { createServer } from 'node:http';
import crypto from 'node:crypto';
import next from 'next';
import { WebSocket, WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { getAioncoreBaseUrl } from './lib/aioncore/config.js';
import { startAioncore, stopAioncore } from './lib/aioncore/launcher.js';
import { chatError, chatLog, chatWarn } from './lib/aioncore/logger.js';
import Task from './models/Task.js';
import { createAioncoreBridgeToken } from './lib/aioncore/bridge-auth.js';

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOST || '0.0.0.0';
const nextHostname = process.env.NEXT_HOSTNAME || hostname;
const port = Number(process.env.PORT || 3000);
const app = next({ dev, hostname: nextHostname, port });
const handle = app.getRequestHandler();
const proxyServer = new WebSocketServer({ noServer: true });

function readAuthToken(cookie = '') {
  return cookie.split(';').map((item) => item.trim().split('=')).find(([key]) => key === 'auth_token')?.[1];
}

function authorize(token) {
  try {
    return process.env.JWT_SECRET ? jwt.verify(token, process.env.JWT_SECRET) : null;
  } catch {
    return null;
  }
}

// 实测这个版本的 AionCore，finish 帧的 data 只有 {"session_id":null}，
// 完全不带 token 用量；真实用量写在会话状态文件里，由结算端点兜底读取。
// 因此这里只负责识别「该结算了」并把 conversation_id 传过去，
// usage 能带就带，带不了交给服务端从状态文件解析。
function settlementTrigger(rawData) {
  try {
    const frame = JSON.parse(String(rawData));
    const name = frame.name || frame.event;
    const payload = frame.data || {};
    const isStreamFinish = name === 'message.stream' && payload.type === 'finish';
    // turn.completed 比 finish 更晚到，此时 AionCore 已经把状态文件落盘。
    // 只挂 finish 的话经常读不到用量，任务就一直停在 reserved。
    const isTurnDone = name === 'turn.completed';
    if (!isStreamFinish && !isTurnDone) return null;
    const usage = isStreamFinish && payload.data && typeof payload.data === 'object' ? payload.data : {};
    return {
      conversationId: payload.conversation_id,
      usage: {
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
        cache_read_tokens: usage.cache_read_tokens,
        cache_write_tokens: usage.cache_write_tokens,
      },
    };
  } catch {
    return null;
  }
}

function settleUsage(userId, settlement, attempt = 0) {
  if (!userId || !settlement?.conversationId) return;
  const body = JSON.stringify({ userId, ...settlement });
  const signature = crypto.createHmac('sha256', process.env.JWT_SECRET).update(body).digest('hex');
  void fetch(`http://127.0.0.1:${port}/api/internal/billing/settle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-officeweb-signature': signature },
    body,
  }).then((response) => {
    if (response.ok) return;
    if (attempt < 3) {
      setTimeout(() => settleUsage(userId, settlement, attempt + 1), 500 * 2 ** attempt);
      return;
    }
    chatWarn('billing', `settlement endpoint returned ${response.status} after retries`);
  }).catch((error) => {
    if (attempt < 3) {
      setTimeout(() => settleUsage(userId, settlement, attempt + 1), 500 * 2 ** attempt);
      return;
    }
    chatError('billing', 'usage settlement failed after retries', error);
  });
}

function callInternal(pathname, label) {
  const body = '{}';
  const signature = crypto.createHmac('sha256', process.env.JWT_SECRET).update(body).digest('hex');
  void fetch(`http://127.0.0.1:${port}${pathname}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-officeweb-signature': signature },
    body,
  }).then(async (response) => {
    if (!response.ok) chatWarn('billing', `${label} returned ${response.status}`);
  }).catch((error) => chatError('billing', `${label} failed`, error));
}

function reconcileBilling() {
  callInternal('/api/internal/billing/reconcile', 'reconciler');
}

// 订阅到期降级、续费提醒、过期订单清理、退款兜底对账。
// 这些都是天级别的业务，10 分钟一轮足够，不必跟着计费对账的 60 秒节奏跑。
function tickSubscriptions() {
  callInternal('/api/internal/subscriptions/tick', 'subscription ticker');
}

// AionCore 把 provider 存在自己的 SQLite 里，storage 一旦重建就会丢，
// 而配置的真源在 Mongo。启动时重放一次，避免部署后聊天静默失效
// （AionCore 会报 Provider '' not found，前端只表现为一直「思考中」）。
function syncAioncoreProvider() {
  callInternal('/api/internal/aioncore/sync-provider', 'provider sync');
}

await startAioncore();
await app.prepare();
const server = createServer((request, response) => handle(request, response));
const handleNextUpgrade = app.getUpgradeHandler();

server.on('upgrade', (request, socket, head) => {
  if (new URL(request.url, `http://${request.headers.host}`).pathname !== '/ws') {
    handleNextUpgrade(request, socket, head);
    return;
  }
  const token = readAuthToken(request.headers.cookie);
  const identity = token ? authorize(decodeURIComponent(token)) : null;
  if (!identity) {
    chatWarn('proxy:ws', 'rejected unauthenticated upgrade');
    socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return;
  }
  proxyServer.handleUpgrade(request, socket, head, (client) => {
    const upstreamUrl = getAioncoreBaseUrl().replace(/^http/, 'ws') + '/ws';
    chatLog('proxy:ws', `browser connected; opening upstream ${upstreamUrl}`);
    const upstream = new WebSocket(upstreamUrl, {
      headers: { Authorization: `Bearer ${createAioncoreBridgeToken(identity.id)}` },
    });
    const pending = [];
    const ownershipCache = new Map();
    // 归属一旦成立就不会被撤销，可以长时间缓存。
    // 否定结果则一律不缓存：/api/process 是先向 AionCore 建会话、再写 Task 行的，
    // AionCore 在建会话瞬间就广播 conversation.listChanged，那一刻 Task 尚不存在。
    // 一旦把这个 false 缓存下来，本轮对话随后的 message.stream 与 turn.completed
    // 会被一并误杀，前端于是永远停在「思考中」。整轮对话往往在一秒内结束，
    // 任何非零的否定 TTL 都可能覆盖掉它，所以这里只缓存肯定结果。
    // 代价是每个尚未归属的会话每帧多一次带索引的 exists 查询；一旦首次命中归属，
    // 后续帧全部走缓存，查询次数是有界的。
    const OWNED_TTL_MS = 5 * 60_000;
    const owns = async (kind, value) => {
      if (!value) return false;
      const key = `${kind}:${value}`;
      const cached = ownershipCache.get(key);
      if (cached && cached.expiresAt > Date.now()) return cached.owned;
      if (mongoose.connection.readyState === 0) {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/officecli_saas', { bufferCommands: false });
      }
      const query = kind === 'conversation'
        ? { userId: identity.id, aionConversationId: value }
        : { userId: identity.id, workspace: value };
      const owned = Boolean(await Task.exists(query));
      if (owned) ownershipCache.set(key, { owned, expiresAt: Date.now() + OWNED_TTL_MS });
      return owned;
    };
    const frameScope = (raw) => {
      try {
        const frame = JSON.parse(String(raw));
        const payload = frame.data || frame.payload || {};
        return {
          name: frame.name || frame.event || '',
          conversationId: payload.conversation_id || payload.conversationId || frame.conversation_id,
          workspace: payload.workspace || frame.workspace,
        };
      } catch {
        return null;
      }
    };
    const safeUnscopedEvents = new Set(['ping', 'pong', 'realtime.connected', 'realtime.disconnected', 'realtime.error']);
    const authorizedFrame = async (raw) => {
      const scope = frameScope(raw);
      if (!scope) return false;
      if (scope.conversationId) return owns('conversation', scope.conversationId);
      if (scope.workspace) return owns('workspace', scope.workspace);
      return safeUnscopedEvents.has(scope.name);
    };
    client.on('message', async (data, binary) => {
      if (binary || !await authorizedFrame(data)) {
        chatWarn('proxy:ws', 'blocked outbound frame outside user scope');
        return;
      }
      if (upstream.readyState === WebSocket.OPEN) upstream.send(data, { binary: false });
      else pending.push([data, false]);
    });
    upstream.on('open', () => {
      chatLog('proxy:ws', `upstream connected; flushing ${pending.length} event(s)`);
      for (const [data, binary] of pending.splice(0)) upstream.send(data, { binary });
    });
    upstream.on('message', async (data, binary) => {
      if (binary) return;
      if (!await authorizedFrame(data)) {
        // 以前这里是静默 return，一旦误杀就完全无从排查 —— 前端只会一直转圈。
        chatWarn('proxy:ws', `dropped inbound frame outside user scope: ${frameScope(data)?.name || 'unparsable'}`);
        return;
      }
      if (!binary) settleUsage(identity.id, settlementTrigger(data));
      if (client.readyState === WebSocket.OPEN) client.send(data, { binary: false });
    });
    upstream.on('close', (code, reason) => {
      chatWarn('proxy:ws', `upstream closed code=${code} reason=${reason || '(none)'}`);
      client.close(code, reason);
    });
    upstream.on('error', (error) => {
      chatError('proxy:ws', 'upstream error', error);
      client.close(1011, 'OfficeGPT unavailable');
    });
    client.on('close', () => {
      chatLog('proxy:ws', 'browser disconnected');
      upstream.close();
    });
  });
});

server.listen(port, hostname, () => console.log(`OfficeWeb ready at http://${hostname}:${port}`));
const billingReconcileTimer = setInterval(reconcileBilling, 60_000);
setTimeout(reconcileBilling, 5_000);
const subscriptionTickTimer = setInterval(tickSubscriptions, 10 * 60_000);
setTimeout(tickSubscriptions, 20_000);
setTimeout(syncAioncoreProvider, 8_000);

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`OfficeWeb received ${signal}, shutting down`);
  proxyServer.clients.forEach((client) => client.close(1001, 'Server shutting down'));
  clearInterval(billingReconcileTimer);
  clearInterval(subscriptionTickTimer);
  await new Promise((resolve) => server.close(resolve));
  await stopAioncore();
  process.exit(0);
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
