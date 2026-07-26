import { NextResponse } from 'next/server';
import { convertOfficeToPdf } from '@/lib/tools/adapters/libreoffice-adapter';
import { guardToolRequest } from '@/lib/tools/guard';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const blocked = await guardToolRequest(request, formData);
    if (blocked) return blocked;
    const result = await convertOfficeToPdf(formData.get('file'));
    return new NextResponse(result.body, { headers: { 'Content-Type': result.contentType, 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(result.filename)}` } });
  } catch (error) {
    return NextResponse.json({ error: error.message || '文件转换失败' }, { status: 400 });
  }
}
