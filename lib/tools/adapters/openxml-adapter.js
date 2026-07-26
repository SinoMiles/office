import path from 'node:path';
import { load } from 'cheerio';
import { output, readZipEntries, zipBuffers } from './shared';

const ACTIONS = new Set(['ppt-to-text', 'ppt-notes-extract', 'word-images-extract', 'ppt-images-extract']);

function xmlText(xml) {
  const $ = load(xml, { xmlMode: true });
  return $('a\\:t, w\\:t').map((_, node) => $(node).text()).get().join('\n');
}

export function supportsOpenXmlAction(action) {
  return ACTIONS.has(action);
}

export async function processOpenXml({ action, buffer, baseName }) {
  if (action === 'ppt-to-text' || action === 'ppt-notes-extract') {
    const slideText = action === 'ppt-to-text';
    const entries = await readZipEntries(buffer, slideText ? 'ppt/slides/slide' : 'ppt/notesSlides/notesSlide');
    // 幻灯片目录下还有 _rels 子目录，只保留真正的 xml 分片。
    const slides = entries.filter((entry) => entry.entry.endsWith('.xml'));
    if (!slides.length) throw new Error(slideText ? '未在文件中找到幻灯片内容' : '未在文件中找到演讲者备注');
    const text = slides
      .map((entry, index) => `--- ${slideText ? '幻灯片' : '备注'} ${index + 1} ---\n${xmlText(entry.data.toString('utf8'))}`)
      .join('\n\n');
    return output(text.trim(), `${baseName}_${slideText ? 'slides' : 'notes'}.txt`, 'txt');
  }

  const word = action === 'word-images-extract';
  const entries = await readZipEntries(buffer, word ? 'word/media/' : 'ppt/media/');
  if (!entries.length) throw new Error('文档中没有可提取的图片');
  const zip = await zipBuffers(entries.map((entry) => ({ name: path.basename(entry.entry), data: entry.data })), `${baseName}_images.zip`);
  return output(zip, `${baseName}_images.zip`, 'zip');
}
