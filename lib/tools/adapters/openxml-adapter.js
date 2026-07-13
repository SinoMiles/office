import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { load } from 'cheerio';
import { execFileAsync, output, withTempDir, zipBuffers } from './shared';

const ACTIONS = new Set(['ppt-to-text', 'ppt-notes-extract', 'word-images-extract', 'ppt-images-extract']);

async function unzipEntries(buffer, filename, prefix) {
  return withTempDir('officeweb-openxml-', async (workDir) => {
    const inputPath = path.join(workDir, path.basename(filename));
    await writeFile(inputPath, buffer);
    const { stdout } = await execFileAsync('unzip', ['-Z1', inputPath], { maxBuffer: 4 * 1024 * 1024 });
    const entries = stdout.split('\n').filter((entry) => entry.startsWith(prefix) && !entry.endsWith('/'));
    return Promise.all(entries.map(async (entry) => {
      const result = await execFileAsync('unzip', ['-p', inputPath, entry], { encoding: 'buffer', maxBuffer: 32 * 1024 * 1024 });
      return { entry, data: Buffer.from(result.stdout) };
    }));
  });
}

function xmlText(xml) {
  const $ = load(xml, { xmlMode: true });
  return $('a\\:t, w\\:t').map((_, node) => $(node).text()).get().join('\n');
}

export function supportsOpenXmlAction(action) {
  return ACTIONS.has(action);
}

export async function processOpenXml({ action, file, buffer, baseName }) {
  if (action === 'ppt-to-text' || action === 'ppt-notes-extract') {
    const slideText = action === 'ppt-to-text';
    const entries = await unzipEntries(buffer, file.name, slideText ? 'ppt/slides/slide' : 'ppt/notesSlides/notesSlide');
    const text = entries.map((entry, index) => `--- ${slideText ? '幻灯片' : '备注'} ${index + 1} ---\n${xmlText(entry.data.toString('utf8'))}`).join('\n\n');
    return output(text.trim(), `${baseName}_${slideText ? 'slides' : 'notes'}.txt`, 'txt');
  }
  const word = action === 'word-images-extract';
  const entries = await unzipEntries(buffer, file.name, word ? 'word/media/' : 'ppt/media/');
  if (!entries.length) throw new Error('文档中没有可提取的图片');
  const zip = await zipBuffers(entries.map((entry) => ({ name: path.basename(entry.entry), data: entry.data })), `${baseName}_images.zip`);
  return output(zip, `${baseName}_images.zip`, 'zip');
}
