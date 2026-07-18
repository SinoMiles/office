import fs from 'node:fs/promises';
import path from 'node:path';
import { getCurrentUser } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { isUserVisibleDocument, previewType, resolveWorkspaceEntry, taskWorkspace } from '@/lib/workspace/path-policy';
import Task from '@/models/Task';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_ENTRIES = 600;

async function walk(root) {
  const result = [];
  const queue = [''];
  while (queue.length && result.length < MAX_ENTRIES) {
    const relativeDir = queue.shift();
    const absoluteDir = path.join(root, relativeDir);
    const entries = await fs.readdir(absoluteDir, { withFileTypes: true }).catch(() => []);
    entries.sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (entry.name.startsWith('.') || result.length >= MAX_ENTRIES) continue;
      const relativePath = path.join(relativeDir, entry.name);
      if (entry.isDirectory()) queue.push(relativePath);
      else if (entry.isFile()) {
        if (!isUserVisibleDocument(entry.name)) continue;
        const stat = await fs.stat(path.join(root, relativePath)).catch(() => null);
        result.push({ path: relativePath.split(path.sep).join('/'), name: entry.name, size: stat?.size || 0, updatedAt: stat?.mtime?.toISOString(), previewType: previewType(entry.name) });
      }
    }
  }
  return result;
}

export async function GET(_request, { params }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: '请先登录' }, { status: 401 });
  await connectToDatabase();
  const { id } = await params;
  const task = await Task.findOne({ _id: id, userId: user._id }).select('workspace artifacts originalFile').lean();
  if (!task) return Response.json({ error: '任务不存在' }, { status: 404 });
  const workspace = taskWorkspace(task);
  try {
    const { root } = resolveWorkspaceEntry(workspace, workspace);
    const realRoot = await fs.realpath(root);
    const files = await walk(realRoot);
    const artifactByPath = new Map((task.artifacts || []).map((artifact) => [path.relative(realRoot, artifact.filePath).split(path.sep).join('/'), artifact]));
    return Response.json({ success: true, files: files.map((file) => {
      const artifact = artifactByPath.get(file.path);
      return artifact ? { ...file, artifactId: String(artifact._id), status: artifact.status } : file;
    }) });
  } catch {
    return Response.json({ error: '工作区不可用' }, { status: 404 });
  }
}

async function ownedWorkspace(id, userId) {
  await connectToDatabase();
  const task = await Task.findOne({ _id: id, userId }).select('workspace artifacts originalFile').lean();
  if (!task) throw new Error('TASK_NOT_FOUND');
  const root = await fs.realpath(taskWorkspace(task));
  return root;
}

export async function POST(request, { params }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: '请先登录' }, { status: 401 });
  try {
    const { id } = await params;
    const root = await ownedWorkspace(id, user._id);
    const formData = await request.formData();
    const file = formData.get('file');
    if (!file || typeof file.arrayBuffer !== 'function' || file.size > 25 * 1024 * 1024) return Response.json({ error: '文件无效或超过 25MB' }, { status: 400 });
    const filename = path.basename(file.name).replace(/[^\p{L}\p{N}._-]+/gu, '_');
    const { candidate } = resolveWorkspaceEntry(root, filename);
    await fs.writeFile(candidate, Buffer.from(await file.arrayBuffer()), { flag: 'wx' });
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.code === 'EEXIST' ? '同名文件已存在' : '上传失败' }, { status: 400 });
  }
}

export async function PATCH(request, { params }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: '请先登录' }, { status: 401 });
  try {
    const { id } = await params;
    const root = await ownedWorkspace(id, user._id);
    const { filePath, newName } = await request.json();
    const safeName = path.basename(String(newName || '')).replace(/[^\p{L}\p{N}._-]+/gu, '_');
    if (!safeName) throw new Error('INVALID_NAME');
    const { candidate } = resolveWorkspaceEntry(root, filePath);
    const target = path.join(path.dirname(candidate), safeName);
    resolveWorkspaceEntry(root, target);
    await fs.rename(candidate, target);
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: '重命名失败' }, { status: 400 });
  }
}

export async function DELETE(request, { params }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: '请先登录' }, { status: 401 });
  try {
    const { id } = await params;
    const root = await ownedWorkspace(id, user._id);
    const filePath = new URL(request.url).searchParams.get('path');
    const { candidate } = resolveWorkspaceEntry(root, filePath);
    const stat = await fs.lstat(candidate);
    if (!stat.isFile()) throw new Error('NOT_FILE');
    await fs.unlink(candidate);
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: '删除失败' }, { status: 400 });
  }
}
