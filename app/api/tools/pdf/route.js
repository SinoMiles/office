import { NextResponse } from 'next/server';
import { processPdfLib } from '@/lib/tools/adapters/pdf-lib-adapter';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const result = await processPdfLib(String(formData.get('action') || ''), formData.getAll('files'), formData);
    return new NextResponse(result.body, { headers: { 'Content-Type': result.contentType, 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(result.filename)}` } });
  } catch (error) {
    return NextResponse.json({ error: error.message || '文档处理失败，可能是文件已损坏或加密' }, { status: 400 });
  }
}
