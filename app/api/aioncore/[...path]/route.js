import { getCurrentUser } from '@/lib/auth';
import { getAioncoreBaseUrl } from '@/lib/aioncore/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function proxy(request, context) {
  if (!(await getCurrentUser())) return Response.json({ error: '请先登录' }, { status: 401 });
  const { path } = await context.params;
  const relativePath = path.join('/');
  if (relativePath.startsWith('api/fs/')) {
    return Response.json({ error: '文件系统操作必须通过任务工作区接口' }, { status: 403 });
  }
  const sourceUrl = new URL(request.url);
  const target = `${getAioncoreBaseUrl()}/${relativePath}${sourceUrl.search}`;
  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('cookie');
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
