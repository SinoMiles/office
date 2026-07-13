import { PDFDocument, degrees, rgb } from 'pdf-lib';
import { output } from './shared';

function pageSelection(value, pageCount) {
  const indices = new Set();
  for (const part of String(value || '').split(',').map((item) => item.trim()).filter(Boolean)) {
    const match = part.match(/^(\d+)(?:-(\d+))?$/);
    if (!match) throw new Error('页码格式不正确，请使用例如 1-3,5');
    const start = Number(match[1]);
    const end = Number(match[2] || match[1]);
    if (start < 1 || end < start || end > pageCount) throw new Error(`页码必须在 1-${pageCount} 之间`);
    for (let page = start; page <= end; page += 1) indices.add(page - 1);
  }
  if (!indices.size) throw new Error('请输入要提取的页码');
  return [...indices].sort((a, b) => a - b);
}

export async function processPdfLib(action, files, formData) {
  if (!files.length) throw new Error('请上传至少一个文件');
  if (action === 'merge-pdf') {
    const merged = await PDFDocument.create();
    for (const file of files) {
      const pdf = await PDFDocument.load(await file.arrayBuffer());
      for (const page of await merged.copyPages(pdf, pdf.getPageIndices())) merged.addPage(page);
    }
    return output(await merged.save(), 'merged.pdf', 'pdf');
  }
  if (action === 'split-pdf') {
    const source = await PDFDocument.load(await files[0].arrayBuffer());
    const result = await PDFDocument.create();
    for (const page of await result.copyPages(source, pageSelection(formData.get('pages'), source.getPageCount()))) result.addPage(page);
    return output(await result.save(), 'extracted_pages.pdf', 'pdf');
  }
  if (action === 'watermark') {
    const pdf = await PDFDocument.load(await files[0].arrayBuffer());
    const watermark = String(formData.get('watermark') || '').trim();
    if (!watermark) throw new Error('请输入水印文字');
    for (const page of pdf.getPages()) {
      const { width, height } = page.getSize();
      page.drawText(watermark.slice(0, 80), { x: width / 6, y: height / 2, size: 40, color: rgb(0.7, 0.7, 0.7), opacity: 0.4, rotate: degrees(45) });
    }
    return output(await pdf.save(), 'watermarked.pdf', 'pdf');
  }
  if (action === 'pdf-clean-metadata') {
    const pdf = await PDFDocument.load(await files[0].arrayBuffer());
    pdf.setTitle(''); pdf.setAuthor(''); pdf.setSubject(''); pdf.setKeywords([]); pdf.setProducer(''); pdf.setCreator('');
    return output(await pdf.save(), 'clean_metadata.pdf', 'pdf');
  }
  if (action === 'pdf-page-numbers') {
    const pdf = await PDFDocument.load(await files[0].arrayBuffer());
    const startPage = Number.parseInt(formData.get('startPage') || '1', 10);
    if (!Number.isInteger(startPage) || startPage < 1) throw new Error('起始页码必须是正整数');
    pdf.getPages().forEach((page, index) => {
      const label = String(startPage + index);
      page.drawText(label, { x: page.getSize().width / 2 - label.length * 3, y: 18, size: 10, color: rgb(0.25, 0.25, 0.25) });
    });
    return output(await pdf.save(), 'numbered.pdf', 'pdf');
  }
  if (action === 'img-to-pdf') {
    const pdf = await PDFDocument.create();
    for (const file of files) {
      const bytes = await file.arrayBuffer();
      const lower = file.name.toLowerCase();
      const image = lower.endsWith('.png') ? await pdf.embedPng(bytes) : /\.(jpg|jpeg)$/.test(lower) ? await pdf.embedJpg(bytes) : null;
      if (!image) continue;
      const size = image.scale(1);
      const page = pdf.addPage([size.width, size.height]);
      page.drawImage(image, { x: 0, y: 0, width: size.width, height: size.height });
    }
    if (!pdf.getPageCount()) throw new Error('没有可处理的 JPG 或 PNG 图片');
    return output(await pdf.save(), 'images.pdf', 'pdf');
  }
  throw new Error('不支持的 PDF 操作');
}
