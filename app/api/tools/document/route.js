import { NextResponse } from 'next/server';
import { processOpenXml, supportsOpenXmlAction } from '@/lib/tools/adapters/openxml-adapter';
import { processSheet, supportsSheetAction } from '@/lib/tools/adapters/sheetjs-adapter';
import { processText, supportsTextAction } from '@/lib/tools/adapters/text-adapter';
import { guardToolRequest } from '@/lib/tools/guard';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const blocked = await guardToolRequest(request, formData);
    if (blocked) return blocked;
    const action = String(formData.get('action') || '');
    const files = formData.getAll('files');
    const file = files[0];
    if (!file) return NextResponse.json({ error: '请上传文件' }, { status: 400 });
    const buffer = Buffer.from(await file.arrayBuffer());
    const baseName = String(file.name || 'document').replace(/\.[^.]+$/, '');
    const context = { action, files, file, buffer, baseName, formData };

    let result;
    if (supportsTextAction(action)) result = await processText(context);
    else if (supportsOpenXmlAction(action)) result = await processOpenXml(context);
    else if (supportsSheetAction(action)) result = await processSheet(context);
    else return NextResponse.json({ error: '不支持的文档处理操作' }, { status: 400 });

    return new NextResponse(result.body, {
      headers: {
        'Content-Type': result.contentType,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(result.filename)}`,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || '文件处理失败' }, { status: 400 });
  }
}
