import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  getAioncoreAssetName,
  getAioncoreBinaryPath,
  getAioncoreRuntimeKey,
  parseChecksumFile,
} from '../lib/aioncore/runtime.mjs';

test('maps supported platforms to official AionCore release assets', () => {
  assert.equal(getAioncoreAssetName('v0.1.44', 'darwin', 'arm64'), 'aioncore-v0.1.44-aarch64-apple-darwin.tar.gz');
  assert.equal(getAioncoreAssetName('0.1.44', 'linux', 'x64'), 'aioncore-v0.1.44-x86_64-unknown-linux-gnu.tar.gz');
  assert.equal(getAioncoreAssetName('v0.1.44', 'win32', 'x64'), 'aioncore-v0.1.44-x86_64-pc-windows-msvc.zip');
  assert.equal(getAioncoreRuntimeKey('linux', 'arm64'), 'linux-arm64');
});

test('rejects unsupported runtime targets', () => {
  assert.throws(() => getAioncoreAssetName('v0.1.44', 'freebsd', 'x64'), /不支持/);
  assert.throws(() => getAioncoreAssetName('v0.1.44', 'linux', 'ia32'), /不支持/);
});

test('resolves versioned runtime binary paths outside Git-tracked bin', () => {
  assert.equal(
    getAioncoreBinaryPath('/srv/office', 'v0.1.44', 'linux', 'x64'),
    path.join('/srv/office', '.runtime', 'aioncore', 'v0.1.44', 'linux-x64', 'aioncore'),
  );
});

test('parses official sha256 checksum lists', () => {
  const checksum = '046e2387172f61ed421e0efb1b074ee272a8050cd685963950f074f9c231d83c';
  const entries = parseChecksumFile(`${checksum}  aioncore-v0.1.44-aarch64-apple-darwin.tar.gz\n`);
  assert.equal(entries.get('aioncore-v0.1.44-aarch64-apple-darwin.tar.gz'), checksum);
});
