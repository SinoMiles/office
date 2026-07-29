import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';

const require = createRequire(import.meta.url);

// A live `officecli watch` process is an SSE preview server for one file.
// This mirrors AionUi's OfficeWatchViewer model: the resident that applies the
// edits notifies the watch server, which pushes DOM updates to the browser.
// Registry is process-global so it survives Next.js route module reloads.
const registry = global.officeWebWatchServers || new Map();
global.officeWebWatchServers = registry;

const READY_TIMEOUT_MS = 12_000;
const IDLE_TTL_MS = 30 * 60 * 1000;

/**
 * 解析 officecli 的启动方式，返回 { command, prefixArgs }。
 *
 * 之前这里只找 PATH 上的裸 `officecli`，而它其实是 @officecli/officecli 这个
 * npm 依赖带的可执行文件，安装在 node_modules/.bin 下、并不在 PATH 里 ——
 * 于是 spawn 必然 ENOENT，右侧预览恒定报 OFFICECLI_NOT_FOUND。
 * 原实现里 `if (candidate === 'officecli') return candidate` 还会无条件返回，
 * 使 ~/.local/bin 那个候选成为永远执行不到的死代码。
 *
 * 优先直接用 node 执行包内入口：这样可以完全绕开 npm 在 Windows 上生成的
 * .cmd/.ps1 shim（spawn 不走 shell 时是找不到 .cmd 的），Linux 与 Windows 行为一致。
 */
function resolveLauncher() {
  const override = process.env.OFFICECLI_BIN;
  if (override) {
    try {
      if (fs.existsSync(override)) return { command: override, prefixArgs: [] };
    } catch {
      // 配置了但不可用时继续往下找
    }
  }

  // @officecli/officecli 的 exports 只暴露了 "."，深层导入（含 package.json）
  // 会直接 ERR_PACKAGE_PATH_NOT_EXPORTED，所以必须走它自己的公开 API。
  try {
    const installer = require('@officecli/officecli');
    const native = installer.binaryPath?.();
    if (native && fs.existsSync(native)) return { command: native, prefixArgs: [] };

    // 原生二进制还没下载（postinstall 被跳过或离线失败）时，改跑包根的
    // launcher shim —— 它会在首次运行时惰性下载。用 node 执行以绕开
    // npm 在 Windows 上生成的 .cmd/.ps1 包装。
    const shim = path.resolve(path.dirname(require.resolve('@officecli/officecli')), '..', 'officecli.js');
    if (fs.existsSync(shim)) return { command: process.execPath, prefixArgs: [shim] };
  } catch {
    // 依赖缺失或被打包器改写了 require 语义时，走下面不依赖 require 的路径探测
  }

  // 不依赖 require 的兜底：直接按约定路径找。Turbopack 会重写模块内的 require，
  // 上面那段在打包产物里可能整段失败（现象就是恒定 OFFICECLI_NOT_FOUND）。
  const packageRoot = path.join(process.cwd(), 'node_modules', '@officecli', 'officecli');
  const vendored = path.join(packageRoot, 'vendor', process.platform === 'win32' ? 'officecli.exe' : 'officecli');
  try {
    if (fs.existsSync(vendored)) return { command: vendored, prefixArgs: [] };
    const shim = path.join(packageRoot, 'officecli.js');
    if (fs.existsSync(shim)) return { command: process.execPath, prefixArgs: [shim] };
  } catch {
    // ignore
  }

  const localBin = path.join(os.homedir(), '.local/bin/officecli');
  try {
    if (fs.existsSync(localBin)) return { command: localBin, prefixArgs: [] };
  } catch {
    // ignore
  }

  return { command: 'officecli', prefixArgs: [] };
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

function findAliveEntryByFile(filePath) {
  for (const entry of registry.values()) {
    if (entry.filePath === filePath && isAlive(entry)) return entry;
  }
  return null;
}

function removeEntryAliases(entry) {
  for (const [key, candidate] of registry) {
    if (candidate === entry) registry.delete(key);
  }
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

  // 一个文件只能被一个 officecli watch 进程监听。生成事件和文件卡片可能使用
  // 不同的 task/artifact key 指向同一文件，因此必须按真实文件路径复用进程。
  const shared = findAliveEntryByFile(filePath);
  if (shared) {
    shared.lastUsed = Date.now();
    registry.set(key, shared);
    return shared.port;
  }

  const port = await getFreePort();
  const { command, prefixArgs } = resolveLauncher();
  const proc = spawn(command, [...prefixArgs, 'watch', filePath, '--port', String(port)], {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });

  const entry = { proc, port, filePath, startedAt: Date.now(), lastUsed: Date.now() };
  registry.set(key, entry);

  proc.on('exit', () => {
    removeEntryAliases(entry);
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
    // 原来这里整个吞掉，预览起不来时没有任何线索可查。
    proc.stderr.on('data', (chunk) => console.error('[officecli:watch]', String(chunk).trimEnd()));
    proc.on('error', (err) => {
      clearTimeout(timer);
      registry.delete(key);
      if (err.code === 'ENOENT') {
        console.error(`[officecli:watch] 无法启动预览引擎，命令不存在: ${command} ${prefixArgs.join(' ')}`);
        finish(reject, new Error('OFFICECLI_NOT_FOUND'));
        return;
      }
      finish(reject, err);
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
  if (entry) removeEntryAliases(entry);
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
