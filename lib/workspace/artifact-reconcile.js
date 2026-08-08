import fs from 'node:fs/promises';
import path from 'node:path';
import { isUserVisibleDocument, normalizeWorkspacePath, previewType } from './path-policy.js';
import { isTransientWorkspaceArtifact } from './artifact-names.js';

const IGNORED_DIRECTORIES = new Set(['.aionrs', '.git', 'node_modules']);
const IGNORED_FILES = new Set(['.DS_Store']);

export function isAutomaticBackup(filename = '') {
  const parsed = path.parse(String(filename));
  return /(?:^|[\s._-])backup(?:[\s._-]|$)/i.test(parsed.name)
    || /(?:备份|备份副本|副本)$/.test(parsed.name);
}

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
        if (!entry.name.startsWith('.') && !IGNORED_DIRECTORIES.has(entry.name)) await visit(filePath);
        continue;
      }
      if (!entry.isFile()) continue;
      if (isTransientWorkspaceArtifact(path.relative(root, filePath))) continue;
      if (!isUserVisibleDocument(entry.name)) continue;
      if (isAutomaticBackup(entry.name)) continue;
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
  const uniqueArtifacts = new Map();
  for (const artifact of task.artifacts || []) {
    if (!artifact?.filePath
      || isAutomaticBackup(artifact.filename || artifact.filePath)
      || isTransientWorkspaceArtifact(path.relative(task.workspace, artifact.filePath))) continue;
    try {
      const stat = await fs.stat(artifact.filePath);
      if (!stat.isFile()) continue;
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    const key = path.resolve(artifact.filePath);
    if (!uniqueArtifacts.has(key)) uniqueArtifacts.set(key, artifact);
  }
  if (uniqueArtifacts.size !== (task.artifacts?.length || 0)) task.artifacts = [...uniqueArtifacts.values()];
  const discovered = await discoverWorkspaceArtifacts(task.workspace, task.createdAt?.getTime?.() || 0);
  const inputFiles = new Map((task.attachments || [])
    .filter((attachment) => attachment.filePath)
    .map((attachment) => [path.resolve(attachment.filePath), Number(attachment.uploadedMtimeMs || 0)]));
  if (task.originalFile && !inputFiles.has(path.resolve(task.originalFile))) {
    inputFiles.set(path.resolve(task.originalFile), 0);
  }
  const existing = new Map((task.artifacts || []).map((artifact) => [path.resolve(artifact.filePath), artifact]));
  for (const file of discovered) {
    const inputBaseline = inputFiles.get(file.filePath);
    if (inputBaseline !== undefined && (!inputBaseline || new Date(file.updatedAt).getTime() <= inputBaseline + 1)) continue;
    const artifact = existing.get(file.filePath);
    if (artifact) {
      Object.assign(artifact, file);
    } else {
      task.artifacts.push(file);
    }
  }
  const newest = [...(task.artifacts || [])]
    .filter((artifact) => !isAutomaticBackup(artifact.filename || artifact.filePath))
    .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))[0];
  if (newest) {
    task.outputFile = newest.filePath;
    task.outputFilename = newest.filename;
    task.processedFile = newest.filePath;
  } else {
    task.outputFile = undefined;
    task.outputFilename = undefined;
    task.processedFile = undefined;
  }
  return task.artifacts;
}
