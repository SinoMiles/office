import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { getAioncoreBinaryPath } from './runtime.mjs';

let aioncoreProcess = null;
let stopping = false;
let restartAttempts = 0;
let startPromise = null;

function getRuntimeConfig() {
  const projectRoot = process.cwd();
  const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
  const version = process.env.AIONCORE_VERSION || packageJson.aioncoreVersion;
  const port = Number(process.env.AIONCORE_PORT || 9123);
  const baseUrl = process.env.AIONCORE_URL || `http://127.0.0.1:${port}`;
  const binaryPath = process.env.AIONCORE_BIN || getAioncoreBinaryPath(projectRoot, version);
  const runtimeDir = path.dirname(binaryPath);
  return {
    projectRoot,
    version,
    port,
    baseUrl,
    binaryPath,
    dataDir: process.env.AIONCORE_DATA_DIR || path.join(projectRoot, 'storage', 'aioncore-data'),
    workDir: process.env.AIONCORE_WORK_DIR || path.join(projectRoot, 'storage', 'workspaces'),
    logDir: process.env.AIONCORE_LOG_DIR || path.join(projectRoot, 'storage', 'aioncore-logs'),
    managedResourcesDir: path.join(runtimeDir, 'managed-resources'),
  };
}

async function isHealthy(baseUrl) {
  try {
    const response = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(1500) });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForHealth(baseUrl, child, timeoutMs = 30_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`AionCore 在健康检查完成前退出（code=${child.exitCode}, signal=${child.signalCode}）`);
    }
    if (await isHealthy(baseUrl)) return;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`AionCore 在 ${timeoutMs}ms 内未通过健康检查：${baseUrl}/health`);
}

function scheduleRestart() {
  if (stopping || restartAttempts >= 3) return;
  restartAttempts += 1;
  const delay = 500 * 2 ** (restartAttempts - 1);
  console.warn(`[aioncore] 异常退出，${delay}ms 后进行第 ${restartAttempts} 次重启`);
  setTimeout(() => {
    if (!stopping) void startAioncore({ forceSpawn: true }).catch((error) => console.error('[aioncore] 自动重启失败', error));
  }, delay).unref();
}

async function startAioncoreInternal({ forceSpawn = false } = {}) {
  const config = getRuntimeConfig();
  if (!forceSpawn && await isHealthy(config.baseUrl)) {
    console.log(`[aioncore] 复用已运行的服务：${config.baseUrl}`);
    return { managed: false, baseUrl: config.baseUrl };
  }

  if (process.env.AIONCORE_MANAGED === '0' || !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(config.baseUrl)) {
    throw new Error(`外部 AionCore 不可用：${config.baseUrl}`);
  }
  if (!fs.existsSync(config.binaryPath)) {
    throw new Error(`找不到当前平台的 AionCore：${config.binaryPath}。请先运行 npm run prepare:aioncore，或设置 AIONCORE_BIN。`);
  }

  for (const directory of [config.dataDir, config.workDir, config.logDir]) fs.mkdirSync(directory, { recursive: true });
  const args = [
    '--port', String(config.port),
    '--data-dir', config.dataDir,
    '--work-dir', config.workDir,
    '--log-dir', config.logDir,
    '--parent-pid', String(process.pid),
    '--log-level', process.env.AIONCORE_LOG_LEVEL || 'info',
    '--app-version', '0.1.0',
    '--local',
  ];
  if (fs.existsSync(config.managedResourcesDir)) args.push('--managed-resources-mode', 'bundled');

  console.log(`[aioncore] 启动 ${config.binaryPath} ${args.join(' ')}`);
  let ready = false;
  const child = spawn(config.binaryPath, args, {
    cwd: config.workDir,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  aioncoreProcess = child;
  child.stdout.on('data', (data) => {
    for (const line of String(data).split('\n')) if (line.trim()) console.log(`[aioncore] ${line}`);
  });
  child.stderr.on('data', (data) => {
    for (const line of String(data).split('\n')) if (line.trim()) console.error(`[aioncore] ${line}`);
  });
  child.once('error', (error) => console.error('[aioncore] 进程错误', error));
  child.once('exit', (code, signal) => {
    if (aioncoreProcess === child) aioncoreProcess = null;
    console.warn(`[aioncore] 已退出 code=${code} signal=${signal || 'none'}`);
    if (ready) scheduleRestart();
  });

  try {
    await waitForHealth(config.baseUrl, child);
    ready = true;
    restartAttempts = 0;
    console.log(`[aioncore] 健康检查通过：${config.baseUrl}`);
    return { managed: true, baseUrl: config.baseUrl };
  } catch (error) {
    child.kill('SIGKILL');
    throw error;
  }
}

export function startAioncore(options) {
  if (aioncoreProcess) return Promise.resolve({ managed: true, baseUrl: getRuntimeConfig().baseUrl });
  if (!startPromise) startPromise = startAioncoreInternal(options).finally(() => { startPromise = null; });
  return startPromise;
}

export async function stopAioncore() {
  stopping = true;
  const child = aioncoreProcess;
  if (!child) return;
  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolve();
    }, 5000);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
    child.kill('SIGTERM');
  });
  aioncoreProcess = null;
}
