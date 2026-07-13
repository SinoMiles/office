import { NextResponse } from 'next/server';
import { renderDocumentImages } from '@/lib/tools/adapters/image-renderer-adapter';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const result = await renderDocumentImages(String(formData.get('action') || ''), formData.get('files'));
    return new NextResponse(result.body, { headers: { 'Content-Type': result.contentType, 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(result.filename)}` } });
  } catch (error) {
    const unavailable = error?.code === 'ENOENT';
    return NextResponse.json({ error: unavailable ? '服务器缺少本地文档渲染组件' : (error.message || '文档转图片失败') }, { status: unavailable ? 500 : 400 });
  }
}
