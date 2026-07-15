import { createServer } from 'node:http';
import crypto from 'node:crypto';
import next from 'next';
import { WebSocket, WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import { getAioncoreBaseUrl } from './lib/aioncore/config.js';
import { chatError, chatLog, chatWarn } from './lib/aioncore/logger.js';

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOST || '0.0.0.0';
const port = Number(process.env.PORT || 3000);
const app = next({ dev, hostname, port });
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
    const name = frame.name || frame.event;
    const payload = frame.data !== undefined ? frame.data : frame.payload;
    if (name !== 'message.stream' || !['finish', 'error', 'cancelled'].includes(payload?.type)) return null;
    const usage = payload.data?.usage || payload.usage || (payload.data && typeof payload.data === 'object' ? payload.data : {});
    return {
      conversationId: payload.conversation_id,
      usage: {
        input_tokens: usage.input_tokens || 0,
        output_tokens: usage.output_tokens || 0,
        cached_input_tokens: usage.cached_input_tokens || usage.cache_read_input_tokens || 0,
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
    client.on('message', (data, binary) => {
      if (upstream.readyState === WebSocket.OPEN) upstream.send(data, { binary });
      else pending.push([data, binary]);
    });
    upstream.on('open', () => {
      chatLog('proxy:ws', `upstream connected; flushing ${pending.length} event(s)`);
      for (const [data, binary] of pending.splice(0)) upstream.send(data, { binary });
    });
    upstream.on('message', (data, binary) => {
      if (!binary) settleUsage(identity.id, usageFromFrame(data));
      if (client.readyState === WebSocket.OPEN) client.send(data, { binary });
    });
    upstream.on('close', (code, reason) => {
      chatWarn('proxy:ws', `upstream closed code=${code} reason=${reason || '(none)'}`);
      client.close(code, reason);
    });
    upstream.on('error', (error) => {
      chatError('proxy:ws', 'upstream error', error);
      client.close(1011, 'AionCore unavailable');
    });
    client.on('close', () => {
      chatLog('proxy:ws', 'browser disconnected');
      upstream.close();
    });
  });
});

server.listen(port, hostname, () => console.log(`OfficeWeb ready at http://${hostname}:${port}`));
