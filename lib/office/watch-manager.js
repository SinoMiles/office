import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';

// A live `officecli watch` process is an SSE preview server for one file.
// This mirrors AionUi's OfficeWatchViewer model: the resident that applies the
// edits notifies the watch server, which pushes DOM updates to the browser.
// Registry is process-global so it survives Next.js route module reloads.
const registry = global.officeWebWatchServers || new Map();
global.officeWebWatchServers = registry;

const READY_TIMEOUT_MS = 12_000;
const IDLE_TTL_MS = 30 * 60 * 1000;

function resolveBinary() {
  const candidates = [
    process.env.OFFICECLI_BIN,
    'officecli', // resolved via PATH by spawn
    path.join(os.homedir(), '.local/bin/officecli'),
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (candidate === 'officecli') return candidate;
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      // ignore and try the next candidate
    }
  }
  return 'officecli';
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

function isAlive(entry) {
  return Boolean(entry && entry.proc && entry.proc.exitCode === null && !entry.proc.killed);
}

/**
 * Ensure an `officecli watch` server is running for a task's file.
 * Returns the loopback port the preview server listens on.
 */
export async function startWatch(taskId, filePath) {
  const key = String(taskId);
  const existing = registry.get(key);
  if (isAlive(existing) && existing.filePath === filePath) {
    existing.lastUsed = Date.now();
    return existing.port;
  }
  if (existing) stopWatch(taskId);

  const port = await getFreePort();
  const binary = resolveBinary();
  const proc = spawn(binary, ['watch', filePath, '--port', String(port)], {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });

  const entry = { proc, port, filePath, startedAt: Date.now(), lastUsed: Date.now() };
  registry.set(key, entry);

  proc.on('exit', () => {
    if (registry.get(key) === entry) registry.delete(key);
  });

  await new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn, arg) => { if (!settled) { settled = true; fn(arg); } };
    const timer = setTimeout(() => finish(reject, new Error('OFFICECLI_PORT_TIMEOUT')), READY_TIMEOUT_MS);

    proc.stdout.setEncoding('utf8');
    proc.stdout.on('data', (chunk) => {
      // WatchServer prints "Watch: http://localhost:<port>" once it is serving.
      if (chunk.includes('Watch: http')) { clearTimeout(timer); finish(resolve); }
    });
    proc.stderr.setEncoding('utf8');
    proc.stderr.on('data', () => {});
    proc.on('error', (err) => {
      clearTimeout(timer);
      registry.delete(key);
      finish(reject, err.code === 'ENOENT' ? new Error('OFFICECLI_NOT_FOUND') : err);
    });
    proc.on('exit', (code) => {
      clearTimeout(timer);
      finish(reject, new Error(`OFFICECLI_START_FAILED (exit ${code})`));
    });
  });

  return port;
}

export function getWatchPort(taskId) {
  const entry = registry.get(String(taskId));
  if (!isAlive(entry)) return null;
  entry.lastUsed = Date.now();
  return entry.port;
}

export function stopWatch(taskId) {
  const key = String(taskId);
  const entry = registry.get(key);
  registry.delete(key);
  if (entry?.proc && entry.proc.exitCode === null) {
    try { entry.proc.kill('SIGTERM'); } catch { /* already gone */ }
  }
}

// Reap watch servers whose task has been idle for too long, so long-lived
// deployments do not accumulate child processes and ports.
function sweep() {
  const now = Date.now();
  for (const [key, entry] of registry) {
    if (!isAlive(entry) || now - entry.lastUsed > IDLE_TTL_MS) stopWatch(key);
  }
}

if (!global.officeWebWatchSweeper) {
  global.officeWebWatchSweeper = setInterval(sweep, 5 * 60 * 1000);
  global.officeWebWatchSweeper.unref?.();
}
