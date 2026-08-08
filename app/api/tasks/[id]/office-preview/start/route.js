import path from 'node:path';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { startWatch } from '@/lib/office/watch-manager';
import Task from '@/models/Task';
import { isTransientWorkspaceArtifact } from '@/lib/workspace/artifact-names';

const OFFICE_EXTENSIONS = new Set(['.pptx', '.docx', '.xlsx', '.xls']);

export async function POST(request, { params }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });
  const { id } = await params;
  const { filePath, workspace } = await request.json();
  const resolvedFile = path.resolve(String(filePath || ''));
  const resolvedWorkspace = path.resolve(String(workspace || ''));
  if (!resolvedFile.startsWith(`${resolvedWorkspace}${path.sep}`)
    || !OFFICE_EXTENSIONS.has(path.extname(resolvedFile).toLowerCase())
    || isTransientWorkspaceArtifact(path.relative(resolvedWorkspace, resolvedFile))) {
    return NextResponse.json({ error: '无效的 Office 预览文件' }, { status: 400 });
  }

  await connectToDatabase();
  const task = await Task.findOne({ _id: id, userId: user._id });
  if (!task) return NextResponse.json({ error: '任务不存在' }, { status: 404 });

  let artifact = task.artifacts?.find((item) => item.filePath === resolvedFile);
  if (!artifact) {
    task.artifacts.push({
      filePath: resolvedFile,
      filename: path.basename(resolvedFile),
      fileType: path.extname(resolvedFile).slice(1).toLowerCase(),
      workspace: resolvedWorkspace,
      status: 'generating',
    });
    artifact = task.artifacts[task.artifacts.length - 1];
  } else {
    artifact.filename = path.basename(resolvedFile);
    artifact.workspace = resolvedWorkspace;
    artifact.status = 'generating';
    artifact.updatedAt = new Date();
  }
  const artifactId = String(artifact._id);
  try {
    await startWatch(`${id}:${artifactId}`, resolvedFile);
  } catch (error) {
    console.error('[OfficeGPT:Preview] document preview engine failed to start:', error);
    artifact.status = 'failed';
    artifact.updatedAt = new Date();
    await task.save();
    return NextResponse.json({ error: 'OfficeGPT 文档预览服务暂时不可用，文件仍可下载' }, { status: 503 });
  }
  task.outputFile = resolvedFile;
  task.outputFilename = path.basename(resolvedFile);
  task.runtime.progress = { type: 'preview', title: `正在生成 ${task.outputFilename}`, filePath: resolvedFile };
  task.runtime.updatedAt = new Date();
  await task.save();

  return NextResponse.json({
    success: true,
    taskId: id,
    artifactId,
    filename: task.outputFilename,
    fileType: artifact.fileType,
    status: artifact.status,
    previewUrl: `/api/tasks/${id}/office-preview/proxy/${artifactId}/`,
    downloadUrl: `/api/tasks/${id}/download?artifactId=${encodeURIComponent(artifactId)}`,
  });
}
