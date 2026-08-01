import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

function runtimeRoot() {
  return path.resolve(process.env.OFFICECLI_RUNTIME_DIR || path.join(process.env.STORAGE_DIR || path.join(process.cwd(), 'storage'), 'officecli-runtime'));
}

function packageVersion(directory) {
  try {
    return JSON.parse(fs.readFileSync(path.join(directory, 'node_modules', '@officecli', 'officecli', 'package.json'), 'utf8')).version;
  } catch {
    return null;
  }
}

function versionParts(version) {
  return String(version || '').split('-')[0].split('.').map((value) => Number(value) || 0);
}

function compareVersions(left, right) {
  const a = versionParts(left);
  const b = versionParts(right);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    if ((a[index] || 0) !== (b[index] || 0)) return (a[index] || 0) - (b[index] || 0);
  }
  return 0;
}

function readJson(filename) {
  try {
    return JSON.parse(fs.readFileSync(filename, 'utf8'));
  } catch {
    return null;
  }
}

function liveUpdateLock(root, { removeStale = false } = {}) {
  const filename = path.join(root, 'update.lock');
  if (!fs.existsSync(filename)) return false;
  try {
    const lock = readJson(filename);
    if (!Number.isInteger(lock?.pid)) throw new Error('invalid lock');
    process.kill(lock.pid, 0);
    return true;
  } catch {
    if (removeStale) fs.rmSync(filename, { force: true });
    return false;
  }
}

function autoUpdateEnabled() {
  const configured = process.env.OFFICECLI_AUTO_UPDATE;
  if (configured === undefined) return process.env.NODE_ENV === 'production';
  return !['0', 'false', 'off', 'no'].includes(configured.trim().toLowerCase());
}

async function latestRelease() {
  const response = await fetch('https://registry.npmjs.org/%40officecli%2Fofficecli', {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`版本服务返回 ${response.status}`);
  const metadata = await response.json();
  const version = metadata['dist-tags']?.latest;
  if (!version) throw new Error('版本服务没有返回最新版本');
  return { version, publishedAt: metadata.time?.[version] || null };
}

export async function getOfficecliRuntimeStatus({ checkLatest = true } = {}) {
  const root = runtimeRoot();
  const managedVersion = packageVersion(path.join(root, 'current'));
  const bundledVersion = packageVersion(process.cwd());
  const activeVersion = managedVersion || bundledVersion;
  const lastCheck = readJson(path.join(root, 'status.json'));
  const statusAge = Date.now() - new Date(lastCheck?.checkedAt || 0).getTime();
  const recentlyQueued = lastCheck?.state === 'queued' && Number.isFinite(statusAge) && statusAge < 15_000;
  const updateInProgress = liveUpdateLock(root, { removeStale: true }) || recentlyQueued;
  let release = null;
  let checkError = null;
  if (checkLatest && !updateInProgress) {
    try {
      release = await latestRelease();
    } catch (error) {
      checkError = error.message;
    }
  }
  const latestVersion = release?.version || lastCheck?.latestVersion || null;
  const updating = updateInProgress;
  return {
    activeVersion,
    managedVersion,
    bundledVersion,
    source: managedVersion ? 'managed' : 'bundled',
    latestVersion,
    latestPublishedAt: release?.publishedAt || null,
    updateAvailable: Boolean(activeVersion && latestVersion && compareVersions(latestVersion, activeVersion) > 0),
    updating,
    lastCheck,
    checkError,
    automatic: {
      enabled: autoUpdateEnabled(),
      intervalHours: Number(process.env.OFFICECLI_UPDATE_INTERVAL_HOURS || 24),
      startupDelaySeconds: Number(process.env.OFFICECLI_UPDATE_STARTUP_DELAY_SECONDS || 60),
      minimumReleaseAgeHours: Number(process.env.OFFICECLI_UPDATE_MIN_AGE_HOURS || 24),
    },
  };
}

export function startOfficecliRuntimeUpdate({ force = false } = {}) {
  const root = runtimeRoot();
  fs.mkdirSync(root, { recursive: true });
  if (liveUpdateLock(root, { removeStale: true })) return { started: false, reason: 'running' };
  const statusPath = path.join(root, 'status.json');
  fs.writeFileSync(statusPath, `${JSON.stringify({ state: 'queued', phase: '等待升级任务启动', percent: 2, checkedAt: new Date().toISOString() }, null, 2)}\n`);
  const child = spawn(process.execPath, [path.join(process.cwd(), 'scripts', 'update-officecli.mjs'), ...(force ? ['--force'] : [])], {
    cwd: process.cwd(),
    env: process.env,
    detached: process.platform !== 'win32',
    stdio: 'ignore',
    windowsHide: true,
  });
  child.once('error', (error) => {
    fs.writeFileSync(statusPath, `${JSON.stringify({ state: 'error', error: error.message, checkedAt: new Date().toISOString() }, null, 2)}\n`);
  });
  child.unref();
  return { started: true, pid: child.pid };
}
