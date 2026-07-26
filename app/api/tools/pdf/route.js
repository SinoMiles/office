import { NextResponse } from 'next/server';
import { processPdfLib } from '@/lib/tools/adapters/pdf-lib-adapter';
import { protectPdf } from '@/lib/tools/adapters/qpdf-adapter';
import { guardToolRequest } from '@/lib/tools/guard';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const blocked = await guardToolRequest(request, formData);
    if (blocked) return blocked;
    const action = String(formData.get('action') || '');
    let result;
    if (action === 'encrypt') {
      result = await protectPdf(formData.get('files'), String(formData.get('password') || ''));
    } else {
      result = await processPdfLib(action, formData.getAll('files'), formData);
    }
    return new NextResponse(result.body, { headers: { 'Content-Type': result.contentType, 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(result.filename)}` } });
  } catch (error) {
    return NextResponse.json({ error: error.message || '文档处理失败，可能是文件已损坏或加密' }, { status: 400 });
  }
}
