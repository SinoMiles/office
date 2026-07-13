import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

export const execFileAsync = promisify(execFile);

export const MIME_TYPES = {
  txt: 'text/plain; charset=utf-8',
  csv: 'text/csv; charset=utf-8',
  json: 'application/json; charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  zip: 'application/zip',
  pdf: 'application/pdf',
};

export function output(body, filename, type) {
  return { body, filename, contentType: MIME_TYPES[type] };
}

export async function zipBuffers(items, filename) {
  const workDir = await mkdtemp(path.join(tmpdir(), 'officeweb-zip-'));
  try {
    const paths = [];
    for (const [index, item] of items.entries()) {
      const target = path.join(workDir, `${String(index + 1).padStart(3, '0')}-${path.basename(item.name)}`);
      await writeFile(target, item.data);
      paths.push(target);
    }
    const zipPath = path.join(workDir, filename);
    await execFileAsync('zip', ['-j', zipPath, ...paths], { maxBuffer: 4 * 1024 * 1024 });
    return await readFile(zipPath);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

export async function withTempDir(prefix, work) {
  const workDir = await mkdtemp(path.join(tmpdir(), prefix));
  try {
    return await work(workDir);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
