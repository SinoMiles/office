import fs from 'node:fs';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const scopePackage = '@officecli/officecli';
const runtimeRoot = path.resolve(process.env.OFFICECLI_RUNTIME_DIR || path.join(process.env.STORAGE_DIR || path.join(process.cwd(), 'storage'), 'officecli-runtime'));
const versionsDir = path.join(runtimeRoot, 'versions');
const currentLink = path.join(runtimeRoot, 'current');
const lockPath = path.join(runtimeRoot, 'update.lock');
const statusPath = path.join(runtimeRoot, 'status.json');
const minAgeHours = Math.max(0, Number(process.env.OFFICECLI_UPDATE_MIN_AGE_HOURS ?? 24));
const keepVersions = Math.max(2, Number(process.env.OFFICECLI_KEEP_VERSIONS ?? 3));
const downloadTimeoutMinutes = Math.max(10, Number(process.env.OFFICECLI_DOWNLOAD_TIMEOUT_MINUTES ?? 30));
const force = process.argv.includes('--force');
const dryRun = process.argv.includes('--dry-run');

function log(message) {
  process.stdout.write(`[officecli:update] ${message}\n`);
}

function writeStatus(status) {
  const temporary = `${statusPath}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(status, null, 2)}\n`);
  if (process.platform === 'win32') fs.rmSync(statusPath, { force: true });
  fs.renameSync(temporary, statusPath);
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'pipe', windowsHide: true, ...options });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk) => { stdout += chunk; });
    child.stderr?.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${command} exited ${code}: ${(stderr || stdout).trim()}`));
    });
  });
}

function versionParts(version) {
  return String(version).split('-')[0].split('.').map((value) => Number(value) || 0);
}

function compareVersions(left, right) {
  const a = versionParts(left);
  const b = versionParts(right);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    if ((a[index] || 0) !== (b[index] || 0)) return (a[index] || 0) - (b[index] || 0);
  }
  return 0;
}

function installedVersion(directory) {
  try {
    return JSON.parse(fs.readFileSync(path.join(directory, 'node_modules', '@officecli', 'officecli', 'package.json'), 'utf8')).version;
  } catch {
    return null;
  }
}

function launcher(directory) {
  return path.join(directory, 'node_modules', '@officecli', 'officecli', 'officecli.js');
}

function releaseAsset() {
  const { platform, arch } = process;
  if (platform === 'win32' && ['x64', 'arm64'].includes(arch)) return `officecli-win-${arch}.exe`;
  if (platform === 'darwin' && ['x64', 'arm64'].includes(arch)) return `officecli-mac-${arch}`;
  if (platform === 'linux' && ['x64', 'arm64'].includes(arch)) {
    const musl = fs.existsSync('/etc/alpine-release') || !process.report?.getReport()?.header?.glibcVersionRuntime;
    return `officecli-linux-${musl ? 'alpine-' : ''}${arch}`;
  }
  throw new Error(`unsupported OfficeCLI platform: ${platform}-${arch}`);
}

async function fetchReleaseFile(url, destination, onProgress, signal) {
  const response = await fetch(url, { headers: { 'User-Agent': 'officegpt-runtime-updater' }, redirect: 'follow', signal: AbortSignal.any([signal, AbortSignal.timeout(downloadTimeoutMinutes * 60_000)]) });
  if (!response.ok || !response.body) throw new Error(`${url} returned ${response.status}`);
  const total = Number(response.headers.get('content-length')) || 0;
  let received = 0;
  let lastReportedAt = 0;
  const startedAt = Date.now();
  const meter = new Transform({
    transform(chunk, encoding, callback) {
      received += chunk.length;
      const now = Date.now();
      if (now - lastReportedAt >= 300 || (total && received >= total)) {
        lastReportedAt = now;
        onProgress?.({ received, total, ratio: total ? Math.min(1, received / total) : null, bytesPerSecond: received / Math.max(1, (now - startedAt) / 1000) });
      }
      callback(null, chunk);
    },
  });
  await pipeline(Readable.fromWeb(response.body), meter, fs.createWriteStream(destination));
}

async function installBinary(directory, version, onProgress) {
  const asset = releaseAsset();
  const packageRoot = path.join(directory, 'node_modules', '@officecli', 'officecli');
  const vendorDir = path.join(packageRoot, 'vendor');
  const destination = path.join(vendorDir, process.platform === 'win32' ? 'officecli.exe' : 'officecli');
  fs.mkdirSync(vendorDir, { recursive: true });
  const bases = String(process.env.OFFICECLI_RELEASE_BASES || 'https://d.officecli.ai/releases/download/v{version},https://github.com/iOfficeAI/OfficeCLI/releases/download/v{version}')
    .split(',').map((value) => value.trim().replaceAll('{version}', version).replace(/\/$/, '')).filter(Boolean);
  const controllers = bases.map(() => new AbortController());
  let furthestDownload = 0;
  const attempts = bases.map(async (base, index) => {
    const temporary = `${destination}.download-${index}`;
    try {
      log(`downloading ${asset} from ${base}`);
      const sumsResponse = await fetch(`${base}/SHA256SUMS`, { headers: { 'User-Agent': 'officegpt-runtime-updater' }, signal: AbortSignal.any([controllers[index].signal, AbortSignal.timeout(60_000)]) });
      if (!sumsResponse.ok) throw new Error(`SHA256SUMS returned ${sumsResponse.status}`);
      const sums = await sumsResponse.text();
      const row = sums.split(/\r?\n/).map((line) => line.trim().split(/\s+/)).find((parts) => parts[1]?.replace(/^\*/, '') === asset);
      if (!row?.[0]) throw new Error(`${asset} is missing from SHA256SUMS`);
      await fetchReleaseFile(`${base}/${asset}`, temporary, (download) => {
        const position = download.ratio ?? download.received;
        if (position < furthestDownload) return;
        furthestDownload = position;
        onProgress?.({ ...download, source: base });
      }, controllers[index].signal);
      const actual = crypto.createHash('sha256').update(fs.readFileSync(temporary)).digest('hex');
      if (actual.toLowerCase() !== row[0].toLowerCase()) throw new Error(`checksum mismatch for ${asset}`);
      return { temporary, base };
    } catch (error) {
      fs.rmSync(temporary, { force: true });
      if (error.name !== 'AbortError') log(`source failed (${base}): ${error.message}`);
      throw error;
    }
  });
  try {
    const winner = await Promise.any(attempts);
    controllers.forEach((controller) => controller.abort());
    await Promise.allSettled(attempts);
    fs.renameSync(winner.temporary, destination);
    if (process.platform !== 'win32') fs.chmodSync(destination, 0o755);
    log(`binary checksum verified from ${winner.base}`);
  } catch (error) {
    controllers.forEach((controller) => controller.abort());
    await Promise.allSettled(attempts);
    const messages = error instanceof AggregateError ? error.errors.map((item) => item.message).join('; ') : error.message;
    throw new Error(`all OfficeCLI download sources failed: ${messages}`);
  }
}

async function smokeTest(directory, expectedVersion, onStep) {
  const shim = launcher(directory);
  if (!fs.existsSync(shim)) throw new Error('OfficeCLI launcher is missing after installation');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'officecli-smoke-'));
  try {
    const versionResult = await run(process.execPath, [shim, '--version'], { cwd: tempDir });
    const reportedVersion = `${versionResult.stdout} ${versionResult.stderr}`.trim();
    log(`candidate reports ${reportedVersion}`);
    if (expectedVersion && !reportedVersion.includes(expectedVersion)) throw new Error(`candidate version mismatch; expected ${expectedVersion}`);
    const files = ['smoke.docx', 'smoke.xlsx', 'smoke.pptx'];
    for (let index = 0; index < files.length; index += 1) {
      const filename = files[index];
      onStep?.(filename, index, files.length);
      await run(process.execPath, [shim, 'create', filename], { cwd: tempDir });
      await run(process.execPath, [shim, 'validate', filename], { cwd: tempDir });
      if (!fs.existsSync(path.join(tempDir, filename)) || fs.statSync(path.join(tempDir, filename)).size === 0) {
        throw new Error(`${filename} smoke output is empty`);
      }
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function switchCurrent(targetDir) {
  const temporaryLink = `${currentLink}.next-${process.pid}`;
  const previousLink = `${currentLink}.previous-${process.pid}`;
  fs.rmSync(temporaryLink, { recursive: true, force: true });
  fs.symlinkSync(targetDir, temporaryLink, process.platform === 'win32' ? 'junction' : 'dir');
  if (process.platform !== 'win32') {
    fs.renameSync(temporaryLink, currentLink);
    return;
  }
  if (fs.existsSync(currentLink)) fs.renameSync(currentLink, previousLink);
  try {
    fs.renameSync(temporaryLink, currentLink);
    fs.rmSync(previousLink, { recursive: true, force: true });
  } catch (error) {
    if (!fs.existsSync(currentLink) && fs.existsSync(previousLink)) fs.renameSync(previousLink, currentLink);
    throw error;
  }
}

function cleanupVersions(activeVersion) {
  const directories = fs.readdirSync(versionsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d+\.\d+\.\d+/.test(entry.name))
    .map((entry) => ({ name: entry.name, fullPath: path.join(versionsDir, entry.name), mtime: fs.statSync(path.join(versionsDir, entry.name)).mtimeMs }))
    .sort((left, right) => right.mtime - left.mtime);
  const keep = new Set([activeVersion, ...directories.slice(0, keepVersions).map((item) => item.name)]);
  for (const directory of directories) {
    if (!keep.has(directory.name)) fs.rmSync(directory.fullPath, { recursive: true, force: true });
  }
}

async function registryMetadata() {
  const response = await fetch('https://registry.npmjs.org/%40officecli%2Fofficecli', { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`npm registry returned ${response.status}`);
  return response.json();
}

fs.mkdirSync(versionsDir, { recursive: true });
let lockHandle;
if (fs.existsSync(lockPath)) {
  let lockIsLive = false;
  try {
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    if (Number.isInteger(lock.pid)) {
      process.kill(lock.pid, 0);
      lockIsLive = true;
    }
  } catch {
    lockIsLive = false;
  }
  if (!lockIsLive) fs.rmSync(lockPath, { force: true });
}
try {
  lockHandle = fs.openSync(lockPath, 'wx');
  fs.writeFileSync(lockHandle, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
  for (const entry of fs.readdirSync(versionsDir, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name.startsWith('.staging-')) fs.rmSync(path.join(versionsDir, entry.name), { recursive: true, force: true });
  }
} catch (error) {
  if (error.code === 'EEXIST') {
    log('another update is already running');
    process.exit(0);
  }
  throw error;
}

try {
  const metadata = await registryMetadata();
  const latest = metadata['dist-tags']?.latest;
  if (!latest) throw new Error('npm registry did not return a latest version');
  const publishedAt = new Date(metadata.time?.[latest] || 0);
  const ageHours = (Date.now() - publishedAt.getTime()) / 3_600_000;
  const currentVersion = installedVersion(currentLink);
  log(`current=${currentVersion || 'none'} latest=${latest} age=${ageHours.toFixed(1)}h`);
  const startedAt = new Date().toISOString();
  const progress = (phase, percent, extra = {}) => writeStatus({ state: 'running', phase, percent, version: currentVersion, latestVersion: latest, startedAt, checkedAt: new Date().toISOString(), ...extra });
  progress('正在检查版本', 8);

  if (!force && currentVersion && compareVersions(latest, currentVersion) <= 0) {
    log('already up to date');
    writeStatus({ state: 'ready', phase: '已是最新版', percent: 100, version: currentVersion, latestVersion: latest, updated: false, checkedAt: new Date().toISOString() });
    process.exitCode = 0;
  } else if (!force && (!Number.isFinite(ageHours) || ageHours < minAgeHours)) {
    log(`latest release is younger than ${minAgeHours}h; deferring rollout`);
    writeStatus({ state: 'deferred', phase: '等待稳定期', percent: 100, version: currentVersion, latestVersion: latest, updated: false, checkedAt: new Date().toISOString() });
    process.exitCode = 0;
  } else if (dryRun) {
    log(`dry run: ${latest} is eligible for installation`);
    writeStatus({ state: 'ready', phase: '检查完成', percent: 100, version: currentVersion, latestVersion: latest, updateAvailable: compareVersions(latest, currentVersion) > 0, updated: false, checkedAt: new Date().toISOString() });
    process.exitCode = 0;
  } else {
    const finalDir = path.join(versionsDir, latest);
    if (!installedVersion(finalDir)) {
      const stagingDir = path.join(versionsDir, `.staging-${latest}-${process.pid}-${Date.now()}`);
      fs.mkdirSync(stagingDir, { recursive: true });
      try {
        log(`installing ${scopePackage}@${latest}`);
        progress('正在安装运行包', 18);
        const npmCli = process.env.npm_execpath;
        if (npmCli && fs.existsSync(npmCli)) {
          await run(process.execPath, [npmCli, 'install', '--prefix', stagingDir, `${scopePackage}@${latest}`, '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund', '--save=false'], { cwd: runtimeRoot });
        } else {
          await run('npm', ['install', '--prefix', stagingDir, `${scopePackage}@${latest}`, '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund', '--save=false'], { cwd: runtimeRoot, shell: process.platform === 'win32' });
        }
        progress('正在下载运行文件', 35);
        await installBinary(stagingDir, latest, ({ received, total, ratio, bytesPerSecond, source }) => {
          progress('正在下载运行文件', ratio === null ? 45 : Math.round(35 + ratio * 35), { download: { received, total, bytesPerSecond, source } });
        });
        progress('正在校验文件', 72);
        await smokeTest(stagingDir, latest, (filename, index, count) => {
          progress(`正在验证 ${filename.split('.').pop().toUpperCase()} 文件`, Math.round(78 + (index / count) * 14));
        });
        fs.renameSync(stagingDir, finalDir);
      } catch (error) {
        fs.rmSync(stagingDir, { recursive: true, force: true });
        throw error;
      }
    } else {
      progress('正在验证已下载版本', 78);
      await smokeTest(finalDir, latest, (filename, index, count) => {
        progress(`正在验证 ${filename.split('.').pop().toUpperCase()} 文件`, Math.round(78 + (index / count) * 14));
      });
    }
    progress('正在切换版本', 96);
    switchCurrent(finalDir);
    cleanupVersions(latest);
    writeStatus({ state: 'ready', phase: '升级完成', percent: 100, version: latest, latestVersion: latest, previousVersion: currentVersion, updated: currentVersion !== latest, checkedAt: new Date().toISOString() });
    log(`active version is now ${latest}`);
  }
} catch (error) {
  writeStatus({ state: 'error', phase: '升级失败', percent: 100, error: error.message, checkedAt: new Date().toISOString() });
  console.error(`[officecli:update] failed: ${error.stack || error.message}`);
  process.exitCode = 1;
} finally {
  if (lockHandle !== undefined) fs.closeSync(lockHandle);
  fs.rmSync(lockPath, { force: true });
}
