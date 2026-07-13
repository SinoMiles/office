import { NextResponse } from 'next/server';
import { PDFDocument, rgb, degrees } from 'pdf-lib';

function parsePageSelection(value, pageCount) {
  const indices = new Set();
  for (const part of String(value || '').split(',').map((item) => item.trim()).filter(Boolean)) {
    const match = part.match(/^(\d+)(?:-(\d+))?$/);
    if (!match) throw new Error('页码格式不正确，请使用例如 1-3,5');
    const start = Number(match[1]);
    const end = Number(match[2] || match[1]);
    if (start < 1 || end < start || end > pageCount) throw new Error(`页码必须在 1-${pageCount} 之间`);
    for (let page = start; page <= end; page += 1) indices.add(page - 1);
  }
  if (indices.size === 0) throw new Error('请输入要提取的页码');
  return [...indices].sort((a, b) => a - b);
}

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
      const file = files[0];
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);
      const splitPdf = await PDFDocument.create();
      
      const indices = parsePageSelection(formData.get('pages'), pdf.getPageCount());
      const copiedPages = await splitPdf.copyPages(pdf, indices);
      copiedPages.forEach((page) => splitPdf.addPage(page));
      
      finalPdfBytes = await splitPdf.save();
      downloadName = 'extracted_pages.pdf';
    }
    else if (action === 'watermark') {
      const file = files[0];
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);
      const pages = pdf.getPages();
      
      const watermark = String(formData.get('watermark') || '').trim();
      if (!watermark) return NextResponse.json({ error: '请输入水印文字' }, { status: 400 });
      for (const page of pages) {
        const { width, height } = page.getSize();
        page.drawText(watermark.slice(0, 80), {
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
