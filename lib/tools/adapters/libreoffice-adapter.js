import path from 'node:path';
import { convertToPdfBuffer } from './gotenberg-adapter';
import { output } from './shared';

/**
 * Office 转 PDF。实现已从本地 `soffice` 子进程切换到 Gotenberg 服务
 * （node:24-slim 基础镜像不带 LibreOffice，本地子进程方案在生产必然失败），
 * 保留原导出名以免调用方改动。
 */
export async function convertOfficeToPdf(file) {
  const extension = path.extname(file?.name || '').toLowerCase();
  const baseName = path.basename(file?.name || 'document', extension).replace(/[^\p{L}\p{N}._-]+/gu, '_') || 'document';
  const pdf = await convertToPdfBuffer(file);
  return output(pdf, `${baseName}.pdf`, 'pdf');
}
