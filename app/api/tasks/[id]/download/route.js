import fs from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import Task from '@/models/Task';

const CONTENT_TYPES = {
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.pdf': 'application/pdf',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8',
};

export async function GET(request, { params }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await connectToDatabase();
  const { id } = await params;
  const task = await Task.findOne({ _id: id, userId: user._id }).lean();
  const searchParams = new URL(request.url).searchParams;
  const artifactId = searchParams.get('artifactId');
  const attachmentIndexValue = searchParams.get('attachmentIndex');
  const attachmentIndex = attachmentIndexValue === null ? -1 : Number.parseInt(attachmentIndexValue, 10);
  const artifact = artifactId ? task?.artifacts?.find((item) => String(item._id) === artifactId) : null;
  const attachment = Number.isInteger(attachmentIndex) && attachmentIndex >= 0 ? task?.attachments?.[attachmentIndex] : null;
  const filePath = attachment?.filePath || artifact?.filePath || task?.outputFile;
  if (!filePath) return NextResponse.json({ error: '文件不存在' }, { status: 404 });
  try {
    const buffer = await fs.readFile(filePath);
    const filename = attachment?.filename || artifact?.filename || task.outputFilename || path.basename(filePath);
    const inline = searchParams.get('inline') === '1';
    return new Response(buffer, {
      headers: {
        'Content-Type': CONTENT_TYPES[path.extname(filename).toLowerCase()] || 'application/octet-stream',
        'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch {
    return NextResponse.json({ error: '文件已过期' }, { status: 410 });
  }
}
