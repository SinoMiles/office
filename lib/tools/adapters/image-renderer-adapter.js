import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execFileAsync, output, withTempDir } from './shared';

const OFFICE_EXTENSIONS = new Set(['.doc', '.docx', '.ppt', '.pptx']);

export async function renderDocumentImages(action, file) {
  const extension = path.extname(file?.name || '').toLowerCase();
  if (!file || (extension !== '.pdf' && !OFFICE_EXTENSIONS.has(extension))) throw new Error('仅支持 PDF、Word 和 PowerPoint 文件');
  return withTempDir('officeweb-images-', async (workDir) => {
    const baseName = path.basename(file.name, extension).replace(/[^\p{L}\p{N}._-]+/gu, '_') || 'document';
    const inputPath = path.join(workDir, `${baseName}${extension}`);
    await writeFile(inputPath, Buffer.from(await file.arrayBuffer()));
    let pdfPath = inputPath;
    if (extension !== '.pdf') {
      const soffice = process.env.LIBREOFFICE_PATH || 'soffice';
      await execFileAsync(soffice, [`-env:UserInstallation=file://${path.join(workDir, 'profile')}`, '--headless', '--convert-to', 'pdf', '--outdir', workDir, inputPath], { timeout: 120_000, maxBuffer: 4 * 1024 * 1024 });
      pdfPath = path.join(workDir, `${baseName}.pdf`);
    }
    const format = action.endsWith('-png') ? 'png' : 'jpeg';
    const pdftoppm = process.env.PDFTOPPM_PATH || 'pdftoppm';
    await execFileAsync(pdftoppm, [format === 'png' ? '-png' : '-jpeg', '-r', '150', pdfPath, path.join(workDir, 'page')], { timeout: 120_000, maxBuffer: 4 * 1024 * 1024 });
    const images = (await readdir(workDir)).filter((name) => name.startsWith('page-') && name.endsWith(format === 'png' ? '.png' : '.jpg')).sort();
    if (!images.length) throw new Error('没有生成图片');
    const zipPath = path.join(workDir, `${baseName}_${format}.zip`);
    await execFileAsync('zip', ['-j', zipPath, ...images.map((name) => path.join(workDir, name))], { maxBuffer: 4 * 1024 * 1024 });
    return output(await readFile(zipPath), path.basename(zipPath), 'zip');
  });
}
