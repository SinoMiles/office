import { getCurrentUser } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { getWatchPort } from '@/lib/office/watch-manager';
import Task from '@/models/Task';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function rewritePreviewHtml(html, prefix) {
  return html
    .replaceAll("new EventSource('/events')", `new EventSource('${prefix}/events')`)
    .replaceAll("fetch('/')", `fetch('${prefix}/')`)
    .replaceAll("fetch('/api/", `fetch('${prefix}/api/`);
}

async function proxy(request, { params }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: '请先登录' }, { status: 401 });
  const { id, path = [] } = await params;
  await connectToDatabase();
  if (!(await Task.exists({ _id: id, userId: user._id }))) return Response.json({ error: '任务不存在' }, { status: 404 });
  const port = getWatchPort(id);
  if (!port) return Response.json({ error: '实时预览服务未运行' }, { status: 410 });

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

