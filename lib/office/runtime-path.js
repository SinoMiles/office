import fs from 'node:fs';
import path from 'node:path';

export function configureOfficecliRuntime() {
  const runtimeRoot = path.resolve(process.env.OFFICECLI_RUNTIME_DIR || path.join(process.env.STORAGE_DIR || path.join(process.cwd(), 'storage'), 'officecli-runtime'));
  const current = path.join(runtimeRoot, 'current');
  const packageRoot = path.join(current, 'node_modules', '@officecli', 'officecli');
  const binary = path.join(packageRoot, 'vendor', process.platform === 'win32' ? 'officecli.exe' : 'officecli');
  const bundledBinary = path.join(process.cwd(), 'node_modules', '@officecli', 'officecli', 'vendor', process.platform === 'win32' ? 'officecli.exe' : 'officecli');
  const binDir = path.join(current, 'node_modules', '.bin');
  const brandedBinDir = path.join(runtimeRoot, 'bin');
  const customCliRoot = path.resolve(process.cwd(), '..', 'officegpt-cli');
  const customCliDll = path.join(customCliRoot, 'src', 'officecli', 'bin', 'Debug', 'net10.0', 'officecli.dll');
  const customDotnet = path.join(customCliRoot, '.tools', 'dotnet', process.platform === 'win32' ? 'dotnet.exe' : 'dotnet');
  const useCustomDevelopmentCli = process.env.NODE_ENV !== 'production'
    && fs.existsSync(customCliDll)
    && fs.existsSync(customDotnet);
  fs.mkdirSync(brandedBinDir, { recursive: true });
  if (process.platform === 'win32') {
    const wrapper = path.join(brandedBinDir, 'officegpt.cmd');
    fs.writeFileSync(wrapper, useCustomDevelopmentCli
      ? `@echo off\r\n"${customDotnet}" "${customCliDll}" %*\r\n`
      : `@echo off\r\nif exist "${binary}" (\r\n  "${binary}" %*\r\n) else (\r\n  "${bundledBinary}" %*\r\n)\r\n`);
  } else {
    const wrapper = path.join(brandedBinDir, 'officegpt');
    fs.writeFileSync(wrapper, `#!/bin/sh\nif [ -x "${binary}" ]; then\n  exec "${binary}" "$@"\nelse\n  exec "${bundledBinary}" "$@"\nfi\n`);
    fs.chmodSync(wrapper, 0o755);
  }
  const pathEntries = String(process.env.PATH || '').split(path.delimiter);
  if (!pathEntries.includes(brandedBinDir)) process.env.PATH = `${brandedBinDir}${path.delimiter}${process.env.PATH || ''}`;
  if (!pathEntries.includes(binDir)) process.env.PATH = `${binDir}${path.delimiter}${process.env.PATH || ''}`;
  const activeBinary = fs.existsSync(binary) ? binary : bundledBinary;
  if (useCustomDevelopmentCli) {
    process.env.OFFICECLI_DOTNET = customDotnet;
    process.env.OFFICECLI_DLL = customCliDll;
  } else {
    delete process.env.OFFICECLI_DOTNET;
    delete process.env.OFFICECLI_DLL;
  }
  if (!useCustomDevelopmentCli && !fs.existsSync(activeBinary)) return null;
  process.env.OFFICECLI_BIN = activeBinary;
  return { runtimeRoot, current, binary: useCustomDevelopmentCli ? customCliDll : activeBinary };
}
