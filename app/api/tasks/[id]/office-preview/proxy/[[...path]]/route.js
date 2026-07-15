import { getCurrentUser } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { getWatchPort, startWatch } from '@/lib/office/watch-manager';
import Task from '@/models/Task';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function rewritePreviewHtml(html, prefix) {
  return html
    .replaceAll("new EventSource('/events')", `new EventSource('${prefix}/events')`)
    .replaceAll("fetch('/')", `fetch('${prefix}/')`)
    .replaceAll("fetch('/api/", `fetch('${prefix}/api/`)
    .replace('</head>', `<style>
      * { scrollbar-width: thin; scrollbar-color: rgba(100,116,139,.48) transparent; }
      *::-webkit-scrollbar { width: 10px; height: 10px; }
      *::-webkit-scrollbar-track { background: transparent; }
      *::-webkit-scrollbar-thumb { min-height: 42px; border: 3px solid transparent; border-radius: 999px; background: linear-gradient(180deg, rgba(148,163,184,.72), rgba(100,116,139,.58)) padding-box; }
      *::-webkit-scrollbar-thumb:hover { background: linear-gradient(180deg, rgba(100,116,139,.8), rgba(71,85,105,.72)) padding-box; }
    </style></head>`);
}

async function proxy(request, { params }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: '请先登录' }, { status: 401 });
  const { id, path = [] } = await params;
  await connectToDatabase();
  const task = await Task.findOne({ _id: id, userId: user._id }).select('outputFile').lean();
  if (!task) return Response.json({ error: '任务不存在' }, { status: 404 });
  let port = getWatchPort(id);
  if (!port && task.outputFile) {
    try {
      port = await startWatch(id, task.outputFile);
    } catch (error) {
      return Response.json({ error: error.message || '实时预览恢复失败' }, { status: 502 });
    }
  }
  if (!port) return Response.json({ error: '预览不存在' }, { status: 404 });

  const source = new URL(request.url);
  const target = `http://127.0.0.1:${port}/${path.join('/')}${source.search}`;
  const response = await fetch(target, { headers: { accept: request.headers.get('accept') || '*/*' }, cache: 'no-store' });
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'private, no-store');
  headers.delete('content-security-policy');

  if (response.headers.get('content-type')?.includes('text/html')) {
    const prefix = `/api/tasks/${id}/office-preview/proxy`;
    const html = rewritePreviewHtml(await response.text(), prefix);
    headers.delete('content-length');
    return new Response(html, { status: response.status, headers });
  }
  return new Response(response.body, { status: response.status, headers });
}

export const GET = proxy;
export const HEAD = proxy;
