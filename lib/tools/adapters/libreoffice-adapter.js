import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execFileAsync, output, withTempDir } from './shared';

const ALLOWED_EXTENSIONS = new Set(['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx']);

export async function convertOfficeToPdf(file) {
  const extension = path.extname(file?.name || '').toLowerCase();
  if (!file || !ALLOWED_EXTENSIONS.has(extension)) throw new Error('请上传 Word、Excel 或 PowerPoint 文件');
  return withTempDir('officeweb-convert-', async (workDir) => {
    const safeBaseName = path.basename(file.name, extension).replace(/[^\p{L}\p{N}._-]+/gu, '_') || 'document';
    const inputPath = path.join(workDir, `${safeBaseName}${extension}`);
    await writeFile(inputPath, Buffer.from(await file.arrayBuffer()));
    const soffice = process.env.LIBREOFFICE_PATH || 'soffice';
    await execFileAsync(soffice, [`-env:UserInstallation=file://${path.join(workDir, 'libreoffice-profile')}`, '--headless', '--convert-to', 'pdf', '--outdir', workDir, inputPath], { timeout: 120_000, maxBuffer: 4 * 1024 * 1024 });
    return output(await readFile(path.join(workDir, `${safeBaseName}.pdf`)), `${path.basename(file.name, extension)}.pdf`, 'pdf');
  });
}
