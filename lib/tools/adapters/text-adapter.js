import mammoth from 'mammoth';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { output } from './shared';

const ACTIONS = new Set(['pdf-to-text', 'word-to-text']);

export function supportsTextAction(action) {
  return ACTIONS.has(action);
}

export async function processText({ action, buffer, baseName }) {
  if (action === 'pdf-to-text') {
    const result = await pdfParse(buffer);
    return output(result.text.trim(), `${baseName}.txt`, 'txt');
  }
  const result = await mammoth.extractRawText({ buffer });
  return output(result.value.trim(), `${baseName}.txt`, 'txt');
}
