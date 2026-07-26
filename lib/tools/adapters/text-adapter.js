import mammoth from 'mammoth';
import { extractPdfText } from './mupdf-adapter';
import { output } from './shared';

const ACTIONS = new Set(['pdf-to-text', 'word-to-text']);

export function supportsTextAction(action) {
  return ACTIONS.has(action);
}

export async function processText({ action, buffer, baseName }) {
  if (action === 'pdf-to-text') {
    // 原先用 pdf-parse@1.1.1，它内置的是 2018 年的 pdf.js，读不了本站
    // img-to-pdf 等工具用 pdf-lib 新建的 PDF（报 Invalid PDF structure）。
    // mupdf 对这类文件解析正常，且是同一套 WASM，不额外增加依赖。
    const text = await extractPdfText(buffer);
    if (!text) throw new Error('未能提取到文本，该 PDF 可能是扫描件，请改用 OCR 工具');
    return output(text, `${baseName}.txt`, 'txt');
  }
  const result = await mammoth.extractRawText({ buffer });
  return output(result.value.trim(), `${baseName}.txt`, 'txt');
}
