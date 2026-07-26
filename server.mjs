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

function usageFromFrame(rawData) {
  try {
    const frame = JSON.parse(String(rawData));
    const payload = frame.data;
    if (frame.name !== 'message.stream' || payload?.type !== 'finish') return null;
    const usage = payload.data;
    if (!usage || typeof usage !== 'object') return null;
    if ((usage.input_tokens || 0) + (usage.output_tokens || 0) <= 0) {
      chatWarn('billing', 'stream_end did not expose token usage', payload);
    }
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

function reconcileBilling() {
  const body = '{}';
  const signature = crypto.createHmac('sha256', process.env.JWT_SECRET).update(body).digest('hex');
  void fetch(`http://127.0.0.1:${port}/api/internal/billing/reconcile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-officeweb-signature': signature },
    body,
  }).then(async (response) => {
    if (!response.ok) chatWarn('billing', `reconciler returned ${response.status}`);
  }).catch((error) => chatError('billing', 'reconciler failed', error));
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
    const upstream = new WebSocket(upstreamUrl);
    const pending = [];
    const ownershipCache = new Map();
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
      ownershipCache.set(key, { owned, expiresAt: Date.now() + 30_000 });
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
      if (binary || !await authorizedFrame(data)) return;
      if (!binary) settleUsage(identity.id, usageFromFrame(data));
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

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`OfficeWeb received ${signal}, shutting down`);
  proxyServer.clients.forEach((client) => client.close(1001, 'Server shutting down'));
  clearInterval(billingReconcileTimer);
  await new Promise((resolve) => server.close(resolve));
  await stopAioncore();
  process.exit(0);
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
