import path from 'node:path';
import { convertToPdfBuffer, isOfficeExtension } from './gotenberg-adapter';
import { renderPdfPages } from './mupdf-adapter';
import { output, zipBuffers } from './shared';

// 原实现依赖 soffice + pdftoppm + zip 三个系统命令，基础镜像一个都没有。
// 现在 Office→PDF 走 Gotenberg，PDF→图片走 mupdf(WASM)，打包走 jszip，零系统依赖。

export async function renderDocumentImages(action, file) {
  const extension = path.extname(file?.name || '').toLowerCase();
  if (!file || (extension !== '.pdf' && !isOfficeExtension(extension))) {
    throw new Error('仅支持 PDF、Word 和 PowerPoint 文件');
  }
  const baseName = path.basename(file.name, extension).replace(/[^\p{L}\p{N}._-]+/gu, '_') || 'document';

  const pdfBuffer = extension === '.pdf'
    ? Buffer.from(await file.arrayBuffer())
    : await convertToPdfBuffer(file);

  const format = action.endsWith('-png') ? 'png' : 'jpeg';
  const { images, total, rendered } = await renderPdfPages(pdfBuffer, { format });
  if (!images.length) throw new Error('没有生成图片');

  // 单页文档直接返回图片本身，省掉解压一步。
  if (images.length === 1) {
    return output(images[0].data, `${baseName}.${format === 'png' ? 'png' : 'jpg'}`, format === 'png' ? 'png' : 'jpeg');
  }
  const entries = rendered < total
    ? [...images, { name: 'README.txt', data: Buffer.from(`文档共 ${total} 页，本次仅导出前 ${rendered} 页。\n如需完整导出，请拆分后分批处理。\n`, 'utf8') }]
    : images;
  const zip = await zipBuffers(entries, `${baseName}_${format}.zip`);
  return output(zip, `${baseName}_${format}.zip`, 'zip');
}
