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
    const html = (await fs.readFile(task.previewFile, 'utf8')).replace('</head>', `<style>
      * { scrollbar-width: thin; scrollbar-color: rgba(100,116,139,.48) transparent; }
      *::-webkit-scrollbar { width: 10px; height: 10px; }
      *::-webkit-scrollbar-track { background: transparent; }
      *::-webkit-scrollbar-thumb { min-height: 42px; border: 3px solid transparent; border-radius: 999px; background: linear-gradient(180deg, rgba(148,163,184,.72), rgba(100,116,139,.58)) padding-box; }
      *::-webkit-scrollbar-thumb:hover { background: linear-gradient(180deg, rgba(100,116,139,.8), rgba(71,85,105,.72)) padding-box; }
    </style></head>`);
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
