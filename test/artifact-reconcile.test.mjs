import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { discoverWorkspaceArtifacts } from '../lib/workspace/artifact-reconcile.js';

test('workspace reconciliation finds generated files and ignores agent internals', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'office-artifacts-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, '.aionrs'), { recursive: true });
  await fs.writeFile(path.join(root, '大纲.md'), '# outline');
  await fs.writeFile(path.join(root, 'build.sh'), '#!/bin/sh');
  await fs.writeFile(path.join(root, 'helper.py'), 'print(1)');
  await fs.writeFile(path.join(root, '.aionrs', 'state.json'), '{}');
  const artifacts = await discoverWorkspaceArtifacts(root);
  assert.deepEqual(artifacts.map((item) => item.filename), ['大纲.md']);
  assert.equal(artifacts[0].fileType, 'markdown');
});
