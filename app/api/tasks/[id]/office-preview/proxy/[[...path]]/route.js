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

export async function proxy(request, { params }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: '请先登录' }, { status: 401 });
  const { id, path = [] } = await params;
  await connectToDatabase();
  const task = await Task.findOne({ _id: id, userId: user._id }).select('outputFile artifacts attachments').lean();
  if (!task) return Response.json({ error: '任务不存在' }, { status: 404 });
  const candidateId = path[0];
  const artifact = candidateId ? task.artifacts?.find((item) => String(item._id) === candidateId) : null;
  const attachmentMatch = candidateId?.match(/^attachment-(\d+)$/);
  const attachment = attachmentMatch ? task.attachments?.[Number(attachmentMatch[1])] : null;
  const selectedFile = artifact || attachment;
  const upstreamPath = selectedFile ? path.slice(1) : path;
  const filePath = selectedFile?.filePath || task.outputFile;
  const watchKey = selectedFile ? `${id}:${candidateId}` : id;
  let port = getWatchPort(watchKey);
  if (!port && filePath) {
    try {
      port = await startWatch(watchKey, filePath);
    } catch (error) {
      // 以前直接把 error.message 甩给前端，用户在预览区看到的就是
      // 裸的 OFFICECLI_NOT_FOUND / OFFICECLI_PORT_TIMEOUT 这类内部代码。
      console.error('[OfficeGPT:Preview] 预览引擎启动失败:', error);
      const hint = {
        OFFICECLI_NOT_FOUND: '文档预览引擎未就绪，文件仍可正常下载',
        OFFICECLI_PORT_TIMEOUT: '文档预览引擎启动超时，请稍后重试或直接下载文件',
      }[error.message] || '实时预览暂时不可用，文件仍可正常下载';
      return Response.json({ error: hint }, { status: 502 });
    }
  }
  if (!port) return Response.json({ error: '预览不存在' }, { status: 404 });

  const source = new URL(request.url);
  const target = `http://127.0.0.1:${port}/${upstreamPath.join('/')}${source.search}`;
  const response = await fetch(target, { headers: { accept: request.headers.get('accept') || '*/*' }, cache: 'no-store' });
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'private, no-store');
  headers.delete('content-security-policy');

  if (response.headers.get('content-type')?.includes('text/html')) {
    const prefix = `/api/tasks/${id}/office-preview/proxy${selectedFile ? `/${candidateId}` : ''}`;
    const html = rewritePreviewHtml(await response.text(), prefix);
    headers.delete('content-length');
    return new Response(html, { status: response.status, headers });
  }
  return new Response(response.body, { status: response.status, headers });
}

export const GET = proxy;
export const HEAD = proxy;
