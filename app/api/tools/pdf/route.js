import { NextResponse } from 'next/server';
import { processPdfLib } from '@/lib/tools/adapters/pdf-lib-adapter';
import { isQpdfAvailable, protectPdf } from '@/lib/tools/adapters/qpdf-adapter';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const action = String(formData.get('action') || '');
    let result;
    if (action === 'encrypt') {
      if (!await isQpdfAvailable()) return NextResponse.json({ error: '服务器尚未安装 qpdf' }, { status: 503 });
      result = await protectPdf(formData.get('files'), String(formData.get('password') || ''));
    } else {
      result = await processPdfLib(action, formData.getAll('files'), formData);
    }
    return new NextResponse(result.body, { headers: { 'Content-Type': result.contentType, 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(result.filename)}` } });
  } catch (error) {
    return NextResponse.json({ error: error.message || '文档处理失败，可能是文件已损坏或加密' }, { status: 400 });
  }
}
