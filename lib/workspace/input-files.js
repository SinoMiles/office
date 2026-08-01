import fs from 'node:fs/promises';
import path from 'node:path';

import { normalizeWorkspacePath } from './path-policy.js';

export async function stageUploadedFile({ sourcePath, workspace, taskId, filename }) {
  const root = normalizeWorkspacePath(workspace);
  if (!root || root === path.parse(root).root) throw new Error('INVALID_WORKSPACE');

  const inputDirectory = path.join(root, 'inputs', String(taskId));
  const target = path.resolve(inputDirectory, path.basename(filename));
  if (!target.startsWith(`${root}${path.sep}`)) throw new Error('PATH_OUTSIDE_WORKSPACE');

  await fs.mkdir(inputDirectory, { recursive: true });
  await fs.copyFile(path.resolve(sourcePath), target);
  const stat = await fs.stat(target);
  return { filePath: target, uploadedMtimeMs: stat.mtimeMs };
}
