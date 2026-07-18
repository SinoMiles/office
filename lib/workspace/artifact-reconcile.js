import fs from 'node:fs/promises';
import path from 'node:path';
import { isUserVisibleDocument, normalizeWorkspacePath, previewType } from './path-policy.js';

const IGNORED_DIRECTORIES = new Set(['.aionrs', '.git', 'node_modules']);
const IGNORED_FILES = new Set(['.DS_Store']);

export async function discoverWorkspaceArtifacts(workspace, since = 0) {
  const root = normalizeWorkspacePath(workspace);
  if (!root || root === path.parse(root).root) return [];
  const found = [];

  async function visit(directory) {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('~$') || IGNORED_FILES.has(entry.name)) continue;
      const filePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORED_DIRECTORIES.has(entry.name)) await visit(filePath);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!isUserVisibleDocument(entry.name)) continue;
      const stat = await fs.stat(filePath);
      if (stat.mtimeMs + 2000 < Number(since || 0)) continue;
      found.push({
        filePath: path.resolve(filePath),
        filename: entry.name,
        fileType: previewType(entry.name),
        workspace: root,
        status: 'ready',
        updatedAt: stat.mtime,
      });
    }
  }

  try {
    await visit(root);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  return found.sort((a, b) => new Date(a.updatedAt) - new Date(b.updatedAt));
}

export async function reconcileTaskArtifacts(task) {
  if (!task?.workspace) return [];
  const discovered = await discoverWorkspaceArtifacts(task.workspace, task.createdAt?.getTime?.() || 0);
  const existing = new Map((task.artifacts || []).map((artifact) => [path.resolve(artifact.filePath), artifact]));
  for (const file of discovered) {
    const artifact = existing.get(file.filePath);
    if (artifact) {
      Object.assign(artifact, file);
    } else {
      task.artifacts.push(file);
    }
  }
  return task.artifacts;
}
