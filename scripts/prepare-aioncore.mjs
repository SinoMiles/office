import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  getAioncoreAssetName,
  getAioncoreBinaryPath,
  getAioncoreRuntimeDir,
  parseChecksumFile,
} from '../lib/aioncore/runtime.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
const version = process.env.AIONCORE_VERSION || packageJson.aioncoreVersion;
if (!version) throw new Error('package.json 缺少 aioncoreVersion');
const repository = process.env.AIONCORE_REPOSITORY || packageJson.aioncoreRepository || 'iOfficeAI/AionCore';

const platform = process.env.AIONCORE_TARGET_PLATFORM || process.platform;
const arch = process.env.AIONCORE_TARGET_ARCH || process.arch;
const assetName = getAioncoreAssetName(version, platform, arch);
const tag = version.startsWith('v') ? version : `v${version}`;
const releaseBase = `https://github.com/${repository}/releases/download/${tag}`;
const runtimeDir = getAioncoreRuntimeDir(projectRoot, tag, platform, arch);
const binaryPath = getAioncoreBinaryPath(projectRoot, tag, platform, arch);
const manifestPath = path.join(runtimeDir, 'manifest.json');

if (fs.existsSync(binaryPath) && fs.existsSync(manifestPath) && process.env.AIONCORE_FORCE_PREPARE !== '1') {
  console.log(`AionCore ${tag} 已准备：${binaryPath}`);
  process.exit(0);
}

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'officeweb-aioncore-'));
const archivePath = path.join(tempDir, assetName);
const extractDir = path.join(tempDir, 'extracted');

async function download(url, outputPath) {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) throw new Error(`下载失败 ${response.status}：${url}`);
  fs.writeFileSync(outputPath, Buffer.from(await response.arrayBuffer()), { mode: 0o600 });
}

function findBinary(directory, name) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const candidate = path.join(directory, entry.name);
    if (entry.isFile() && entry.name === name) return candidate;
    if (entry.isDirectory()) {
      const nested = findBinary(candidate, name);
      if (nested) return nested;
    }
  }
  return null;
}

try {
  console.log(`下载 AionCore ${tag}：${assetName}`);
  const checksumResponse = await fetch(`${releaseBase}/aioncore-checksums.txt`);
  if (!checksumResponse.ok) throw new Error(`下载校验清单失败：${checksumResponse.status}`);
  const checksums = parseChecksumFile(await checksumResponse.text());
  const expectedChecksum = checksums.get(assetName);
  if (!expectedChecksum) throw new Error(`官方校验清单中没有 ${assetName}`);

  await download(`${releaseBase}/${assetName}`, archivePath);
  const actualChecksum = crypto.createHash('sha256').update(fs.readFileSync(archivePath)).digest('hex');
  if (actualChecksum !== expectedChecksum) throw new Error(`AionCore SHA-256 校验失败：期望 ${expectedChecksum}，实际 ${actualChecksum}`);

  fs.mkdirSync(extractDir, { recursive: true });
  if (platform === 'win32') {
    execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', `Expand-Archive -LiteralPath '${archivePath.replaceAll("'", "''")}' -DestinationPath '${extractDir.replaceAll("'", "''")}' -Force`], { stdio: 'inherit' });
  } else {
    execFileSync('tar', ['-xzf', archivePath, '-C', extractDir], { stdio: 'inherit' });
  }

  const extractedBinary = findBinary(extractDir, platform === 'win32' ? 'aioncore.exe' : 'aioncore');
  if (!extractedBinary) throw new Error(`压缩包中找不到 ${platform === 'win32' ? 'aioncore.exe' : 'aioncore'}`);

  fs.rmSync(runtimeDir, { recursive: true, force: true });
  fs.mkdirSync(runtimeDir, { recursive: true });
  fs.copyFileSync(extractedBinary, binaryPath);
  if (platform !== 'win32') fs.chmodSync(binaryPath, 0o755);

  const managedResourcesDir = path.join(runtimeDir, 'managed-resources');
  const prepareDataDir = path.join(tempDir, 'prepare-data');
  execFileSync(binaryPath, ['--data-dir', prepareDataDir, 'prepare-managed-resources', '--bundle-out', managedResourcesDir], { stdio: 'inherit' });

  fs.writeFileSync(manifestPath, `${JSON.stringify({
    version: tag,
    platform,
    arch,
    assetName,
    sha256: actualChecksum,
    source: `${releaseBase}/${assetName}`,
    generatedAt: new Date().toISOString(),
    files: [path.basename(binaryPath), 'managed-resources/'],
  }, null, 2)}\n`);
  console.log(`AionCore 已准备：${binaryPath}`);
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
