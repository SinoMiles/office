import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ error: '请上传有效的文件' }, { status: 400 });
    }

    // Gotenberg API endpoint for Office document conversion
    const gotenbergUrl = 'http://gotenberg:3000/forms/libreoffice/convert';

    // Gotenberg requires the file input field name to be "files"
    const gtFormData = new FormData();
    gtFormData.append('files', file);

    const response = await fetch(gotenbergUrl, {
      method: 'POST',
      body: gtFormData
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gotenberg response error:', errorText);
      throw new Error(`转换服务无响应或处理失败 (HTTP ${response.status})`);
    }

    // Fetch PDF binary data
    const arrayBuffer = await response.arrayBuffer();
    const pdfBuffer = Buffer.from(arrayBuffer);

    // Get original filename without extension and append .pdf
    const originalName = file.name || 'document.docx';
    const baseName = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
    const downloadName = `${baseName}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        // Encode filename for non-ASCII characters
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`
      }
    });

  } catch (error) {
    console.error('Conversion Error:', error);
    return NextResponse.json({ error: error.message || '内部服务错误，转换失败' }, { status: 500 });
  }
}
