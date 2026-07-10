import fs from 'node:fs/promises';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import Task from '@/models/Task';

export async function GET(_request, { params }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await connectToDatabase();
  const { id } = await params;
  const task = await Task.findOne({ _id: id, userId: user._id }).lean();
  if (!task?.previewFile) return NextResponse.json({ error: '预览不存在' }, { status: 404 });
  try {
    const html = await fs.readFile(task.previewFile, 'utf8');
    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline' https: data:; img-src data: blob: https:; font-src data: https:; script-src 'unsafe-inline' https:;",
        'Cache-Control': 'private, no-store',
      },
    });
  } catch {
    return NextResponse.json({ error: '预览已过期' }, { status: 410 });
  }
}

