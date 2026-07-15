import path from 'node:path';

const ARCH_NAMES = { arm64: 'aarch64', x64: 'x86_64' };
const PLATFORM_NAMES = {
  darwin: 'apple-darwin',
  linux: 'unknown-linux-gnu',
  win32: 'pc-windows-msvc',
};

export function getAioncoreRuntimeKey(platform = process.platform, arch = process.arch) {
  if (!PLATFORM_NAMES[platform] || !ARCH_NAMES[arch]) {
    throw new Error(`不支持的 AionCore 运行平台：${platform}-${arch}`);
  }
  return `${platform}-${arch}`;
}

export function getAioncoreAssetName(version, platform = process.platform, arch = process.arch) {
  getAioncoreRuntimeKey(platform, arch);
  const tag = version.startsWith('v') ? version : `v${version}`;
  const extension = platform === 'win32' ? 'zip' : 'tar.gz';
  return `aioncore-${tag}-${ARCH_NAMES[arch]}-${PLATFORM_NAMES[platform]}.${extension}`;
}

export function getAioncoreRuntimeDir(projectRoot, version, platform = process.platform, arch = process.arch) {
  const tag = version.startsWith('v') ? version : `v${version}`;
  return path.join(projectRoot, '.runtime', 'aioncore', tag, getAioncoreRuntimeKey(platform, arch));
}

export function getAioncoreBinaryPath(projectRoot, version, platform = process.platform, arch = process.arch) {
  return path.join(getAioncoreRuntimeDir(projectRoot, version, platform, arch), platform === 'win32' ? 'aioncore.exe' : 'aioncore');
}

export function parseChecksumFile(contents) {
  return new Map(String(contents).split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const match = line.match(/^([a-f\d]{64})\s+\*?(.+)$/i);
    if (!match) throw new Error(`无法解析 AionCore 校验行：${line}`);
    return [match[2], match[1].toLowerCase()];
  }));
}
