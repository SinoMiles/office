import { getCurrentUser } from '@/lib/auth';
import { getAioncoreBaseUrl } from '@/lib/aioncore/config';
import Task from '@/models/Task';
import { aioncoreHeaders } from '@/lib/aioncore/bridge-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function proxy(request, context) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: '请先登录' }, { status: 401 });
  const { path } = await context.params;
  const relativePath = path.join('/');
  if (relativePath.startsWith('api/fs/')) {
    return Response.json({ error: '文件系统操作必须通过任务工作区接口' }, { status: 403 });
  }
  const conversationMatch = relativePath.match(/^api\/conversations\/([^/]+)(?:\/|$)/);
  if (!conversationMatch) return Response.json({ error: '该核心接口不允许由浏览器直接访问' }, { status: 403 });
  const conversationId = decodeURIComponent(conversationMatch[1]);
  const owned = await Task.exists({ userId: user._id, aionConversationId: conversationId });
  if (!owned) return Response.json({ error: '会话不存在或无权访问' }, { status: 404 });
  const sourceUrl = new URL(request.url);
  const target = `${getAioncoreBaseUrl()}/${relativePath}${sourceUrl.search}`;
  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('cookie');
  headers.set('Authorization', aioncoreHeaders(String(user._id)).get('Authorization'));
  const body = ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer();
  const response = await fetch(target, { method: request.method, headers, body, redirect: 'manual' });
  const responseHeaders = new Headers(response.headers);
  responseHeaders.delete('set-cookie');
  return new Response(response.body, { status: response.status, headers: responseHeaders });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
