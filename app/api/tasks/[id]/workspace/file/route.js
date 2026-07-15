import fs from 'node:fs/promises';
import path from 'node:path';
import { getCurrentUser } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { resolveWorkspaceEntry, taskWorkspace } from '@/lib/workspace/path-policy';
import Task from '@/models/Task';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CONTENT_TYPES = { '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8', '.md': 'text/markdown; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.json': 'application/json; charset=utf-8', '.csv': 'text/csv; charset=utf-8' };

export async function GET(request, { params }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: '请先登录' }, { status: 401 });
  await connectToDatabase();
  const { id } = await params;
  const task = await Task.findOne({ _id: id, userId: user._id }).select('workspace artifacts originalFile').lean();
  if (!task) return Response.json({ error: '任务不存在' }, { status: 404 });
  try {
    const requestedPath = new URL(request.url).searchParams.get('path');
    const workspace = taskWorkspace(task);
    const { root, candidate } = resolveWorkspaceEntry(workspace, requestedPath);
    const [realRoot, realCandidate] = await Promise.all([fs.realpath(root), fs.realpath(candidate)]);
    if (realCandidate !== realRoot && !realCandidate.startsWith(`${realRoot}${path.sep}`)) throw new Error('PATH_OUTSIDE_WORKSPACE');
    const stat = await fs.stat(realCandidate);
    if (!stat.isFile() || stat.size > 50 * 1024 * 1024) return Response.json({ error: '文件不可预览' }, { status: 413 });
    const data = await fs.readFile(realCandidate);
    const filename = path.basename(realCandidate);
    const download = new URL(request.url).searchParams.get('download') === '1';
    return new Response(data, { headers: { 'Content-Type': CONTENT_TYPES[path.extname(filename).toLowerCase()] || 'application/octet-stream', 'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(filename)}`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) {
    return Response.json({ error: error.message === 'PATH_OUTSIDE_WORKSPACE' ? '无权访问该文件' : '文件不存在' }, { status: error.message === 'PATH_OUTSIDE_WORKSPACE' ? 403 : 404 });
  }
}
