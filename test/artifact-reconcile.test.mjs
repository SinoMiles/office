import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { discoverWorkspaceArtifacts, isAutomaticBackup, reconcileTaskArtifacts } from '../lib/workspace/artifact-reconcile.js';

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

test('unchanged uploaded files stay hidden but modified inputs become preview artifacts', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'office-modified-input-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const filePath = path.join(root, '工作簿.xlsx');
  await fs.writeFile(filePath, 'original');
  const uploadedMtimeMs = (await fs.stat(filePath)).mtimeMs;
  const task = {
    workspace: root,
    createdAt: new Date(0),
    originalFile: filePath,
    attachments: [{ filePath, uploadedMtimeMs }],
    artifacts: [],
  };

  await reconcileTaskArtifacts(task);
  assert.equal(task.artifacts.length, 0);

  await fs.writeFile(filePath, 'modified result');
  const future = new Date(uploadedMtimeMs + 2000);
  await fs.utimes(filePath, future, future);
  await reconcileTaskArtifacts(task);
  assert.equal(task.artifacts.length, 1);
  assert.equal(task.artifacts[0].filename, '工作簿.xlsx');
  assert.equal(task.outputFile, filePath);
  assert.equal(task.outputFilename, '工作簿.xlsx');
  assert.equal(task.processedFile, filePath);
});

test('automatic backup files are not exposed as generated artifacts', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'office-backups-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(path.join(root, '工作簿_备份.xlsx'), 'backup');
  await fs.writeFile(path.join(root, 'report-backup.docx'), 'backup');
  await fs.writeFile(path.join(root, '工作簿.xlsx'), 'result');

  const artifacts = await discoverWorkspaceArtifacts(root);
  assert.deepEqual(artifacts.map((item) => item.filename), ['工作簿.xlsx']);
  assert.equal(isAutomaticBackup('工作簿_备份.xlsx'), true);
  assert.equal(isAutomaticBackup('report-backup.docx'), true);
  assert.equal(isAutomaticBackup('backuplan.xlsx'), false);
});
