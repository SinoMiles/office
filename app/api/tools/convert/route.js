import { NextResponse } from 'next/server';
import { convertOfficeToPdf } from '@/lib/tools/adapters/libreoffice-adapter';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const result = await convertOfficeToPdf((await request.formData()).get('file'));
    return new NextResponse(result.body, { headers: { 'Content-Type': result.contentType, 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(result.filename)}` } });
  } catch (error) {
    const unavailable = error?.code === 'ENOENT';
    return NextResponse.json({ error: unavailable ? '服务器尚未安装 LibreOffice，暂时无法转换' : (error.message || '文件转换失败') }, { status: unavailable ? 500 : 400 });
  }
}
