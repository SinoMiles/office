import 'server-only';
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { consumeRateLimit, requestIp } from '@/lib/auth-security';
import { getCurrentUser } from '@/lib/auth';

// 工具接口此前完全匿名开放，任何人都能无限调用。转换类工具每次都要占用
// Gotenberg 的 LibreOffice 实例或一份 WASM 渲染内存，是现成的资源耗尽入口。
// 这里不强制登录（免费工具是获客入口），改为按 IP 限流，登录用户放宽额度。

const ANONYMOUS_LIMIT = 20;
const AUTHENTICATED_LIMIT = 120;
const WINDOW_MS = 10 * 60_000;

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_FILES = 20;
const MAX_TOTAL_BYTES = 150 * 1024 * 1024;

/**
 * 通过返回 null 表示放行；否则返回应直接下发给客户端的响应。
 */
export async function guardToolRequest(request, formData) {
  const files = formData.getAll('files').concat(formData.getAll('file')).filter((item) => typeof item?.size === 'number');
  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: `单次最多处理 ${MAX_FILES} 个文件` }, { status: 400 });
  }
  const oversize = files.find((file) => file.size > MAX_FILE_BYTES);
  if (oversize) {
    return NextResponse.json({ error: `文件 ${oversize.name} 超过 ${MAX_FILE_BYTES / 1024 / 1024}MB 上限` }, { status: 413 });
  }
  if (files.reduce((total, file) => total + file.size, 0) > MAX_TOTAL_BYTES) {
    return NextResponse.json({ error: `单次上传总大小不能超过 ${MAX_TOTAL_BYTES / 1024 / 1024}MB` }, { status: 413 });
  }

  await connectToDatabase();
  const user = await getCurrentUser().catch(() => null);
  const identifier = user ? `user:${user._id}` : `ip:${requestIp(request)}`;
  const { allowed, retryAfter } = await consumeRateLimit({
    scope: 'tools',
    identifier,
    limit: user ? AUTHENTICATED_LIMIT : ANONYMOUS_LIMIT,
    windowMs: WINDOW_MS,
  });
  if (!allowed) {
    return NextResponse.json(
      { error: user ? '操作过于频繁，请稍后再试' : '免费额度已用完，请登录后继续使用' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    );
  }
  return null;
}
