import path from 'node:path';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { startWatch } from '@/lib/office/watch-manager';
import Task from '@/models/Task';

const OFFICE_EXTENSIONS = new Set(['.pptx', '.docx', '.xlsx', '.xls']);

export async function POST(request, { params }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });
  const { id } = await params;
  const { filePath, workspace } = await request.json();
  const resolvedFile = path.resolve(String(filePath || ''));
  const resolvedWorkspace = path.resolve(String(workspace || ''));
  if (!resolvedFile.startsWith(`${resolvedWorkspace}${path.sep}`) || !OFFICE_EXTENSIONS.has(path.extname(resolvedFile).toLowerCase())) {
    return NextResponse.json({ error: '无效的 Office 预览文件' }, { status: 400 });
  }

  await connectToDatabase();
  const task = await Task.findOne({ _id: id, userId: user._id });
  if (!task) return NextResponse.json({ error: '任务不存在' }, { status: 404 });

  await startWatch(id, resolvedFile);
  task.outputFile = resolvedFile;
  task.outputFilename = path.basename(resolvedFile);
  task.runtime.progress = { type: 'preview', title: `正在生成 ${task.outputFilename}`, filePath: resolvedFile };
  task.runtime.updatedAt = new Date();
  await task.save();

  return NextResponse.json({
    success: true,
    filename: task.outputFilename,
    previewUrl: `/api/tasks/${id}/office-preview/proxy/`,
    downloadUrl: `/api/tasks/${id}/download`,
  });
}

