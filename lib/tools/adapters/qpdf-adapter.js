import path from 'node:path';
import { encryptPdf, isMupdfAvailable } from './mupdf-adapter';
import { output } from './shared';

// 原实现调用系统 qpdf 二进制，基础镜像不带它，因此该工具在生产恒定返回 503。
// 换成 mupdf(WASM) 的 AES-256 加密后无系统依赖；导出名保持不变。

export async function isQpdfAvailable() {
  return isMupdfAvailable();
}

export async function protectPdf(file, password) {
  if (!file) throw new Error('请上传 PDF 文件');
  if (path.extname(file.name || '').toLowerCase() !== '.pdf') throw new Error('请上传 PDF 文件');
  if (!password || password.length < 6) throw new Error('PDF 密码至少需要 6 个字符');
  const baseName = path.basename(file.name, '.pdf').replace(/[^\p{L}\p{N}._-]+/gu, '_') || 'document';
  const encrypted = await encryptPdf(Buffer.from(await file.arrayBuffer()), password);
  return output(encrypted, `${baseName}_protected.pdf`, 'pdf');
}
