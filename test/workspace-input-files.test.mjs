import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { stageUploadedFile } from '../lib/workspace/input-files.js';

test('uploaded files are staged inside the canonical conversation workspace', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'office-input-workspace-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const source = path.join(root, 'temporary-upload.xlsx');
  const workspace = path.join(root, 'conversation');
  await fs.writeFile(source, 'original workbook');

  const staged = await stageUploadedFile({
    sourcePath: source,
    workspace,
    taskId: 'task-1',
    filename: '工作簿.xlsx',
  });

  assert.equal(staged.filePath, path.join(workspace, 'inputs', 'task-1', '工作簿.xlsx'));
  assert.equal(await fs.readFile(staged.filePath, 'utf8'), 'original workbook');
  assert.ok(staged.uploadedMtimeMs > 0);
});
