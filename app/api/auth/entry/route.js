import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request) {
  const user = await getCurrentUser();
  // 工作台现在一律以空白新对话打开（历史走左侧列表），因此这里不需要
  // 再用参数去抑制「恢复上次会话」——那套逻辑已经整体移除。
  const destination = user ? '/dashboard' : '/register?next=/dashboard';
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  const protocol = request.headers.get('x-forwarded-proto') || 'http';
  const origin = host ? `${protocol}://${host}` : new URL(request.url).origin;
  return NextResponse.redirect(new URL(destination, origin));
}
