import { NextResponse } from 'next/server';
import { PDFDocument, rgb, degrees } from 'pdf-lib';

export async function POST(req) {
  try {
    const formData = await req.formData();
    const action = formData.get('action'); // 'merge-pdf', 'split-pdf', 'watermark', 'encrypt', 'img-to-pdf'
    const files = formData.getAll('files');

    if (!files || files.length === 0) {
      return NextResponse.json({ error: '请上传至少一个文件' }, { status: 400 });
    }

    let finalPdfBytes;
    let downloadName = 'processed.pdf';

    if (action === 'merge-pdf') {
      const mergedPdf = await PDFDocument.create();
      for (const file of files) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
      }
      finalPdfBytes = await mergedPdf.save();
      downloadName = 'merged.pdf';
    } 
    else if (action === 'split-pdf') {
      // 拆分：目前简化为提取前 5 页
      const file = files[0];
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);
      const splitPdf = await PDFDocument.create();
      
      const pageCount = pdf.getPageCount();
      const extractCount = Math.min(pageCount, 5);
      
      const indices = Array.from({ length: extractCount }, (_, i) => i);
      const copiedPages = await splitPdf.copyPages(pdf, indices);
      copiedPages.forEach((page) => splitPdf.addPage(page));
      
      finalPdfBytes = await splitPdf.save();
      downloadName = 'split_first_5_pages.pdf';
    }
    else if (action === 'watermark') {
      const file = files[0];
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);
      const pages = pdf.getPages();
      
      for (const page of pages) {
        const { width, height } = page.getSize();
        page.drawText('OfficeGPT Confidential', {
          x: width / 6,
          y: height / 2,
          size: 40,
          color: rgb(0.7, 0.7, 0.7),
          opacity: 0.4,
          rotate: degrees(45),
        });
      }
      finalPdfBytes = await pdf.save();
      downloadName = 'watermarked.pdf';
    }
    else if (action === 'encrypt') {
      const file = files[0];
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);
      
      // 设置固定密码 123 (仅供演示)
      pdf.encrypt({
        userPassword: '123',
        ownerPassword: 'officegpt_admin',
        permissions: {
          printing: 'highResolution',
          modifying: false,
          copying: false,
        },
      });
      
      finalPdfBytes = await pdf.save();
      downloadName = 'encrypted_pw_123.pdf';
    }
    else if (action === 'img-to-pdf') {
      const pdf = await PDFDocument.create();
      
      for (const file of files) {
        const arrayBuffer = await file.arrayBuffer();
        let image;
        if (file.name.toLowerCase().endsWith('.png')) {
          image = await pdf.embedPng(arrayBuffer);
        } else if (file.name.toLowerCase().match(/\.(jpg|jpeg)$/)) {
          image = await pdf.embedJpg(arrayBuffer);
        } else {
          continue; // 跳过非图片文件
        }
        
        const dims = image.scale(1);
        const page = pdf.addPage([dims.width, dims.height]);
        page.drawImage(image, {
          x: 0,
          y: 0,
          width: dims.width,
          height: dims.height,
        });
      }
      
      finalPdfBytes = await pdf.save();
      downloadName = 'images.pdf';
    }
    else {
      return NextResponse.json({ error: '不支持的操作' }, { status: 400 });
    }

    return new NextResponse(finalPdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`
      }
    });

  } catch (error) {
    console.error('PDF Utils Error:', error);
    return NextResponse.json({ error: error.message || '文档处理失败，可能是文件已损坏或加密' }, { status: 500 });
  }
}
