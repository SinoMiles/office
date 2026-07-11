import { createServer } from 'node:http';
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

function isAuthorized(token) {
  try {
    return Boolean(process.env.JWT_SECRET && jwt.verify(token, process.env.JWT_SECRET));
  } catch {
    return false;
  }
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
  if (!token || !isAuthorized(decodeURIComponent(token))) {
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
