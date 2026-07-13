import { execFile } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const execFileAsync = promisify(execFile);
const OFFICE_EXTENSIONS = new Set(['.doc', '.docx', '.ppt', '.pptx']);

export async function POST(request) {
  let workDir;
  try {
    const formData = await request.formData();
    const action = String(formData.get('action') || '');
    const file = formData.get('files');
    if (!file) return NextResponse.json({ error: '请上传文件' }, { status: 400 });
    const extension = path.extname(file.name).toLowerCase();
    if (extension !== '.pdf' && !OFFICE_EXTENSIONS.has(extension)) return NextResponse.json({ error: '仅支持 PDF、Word 和 PowerPoint 文件' }, { status: 400 });

    workDir = await mkdtemp(path.join(tmpdir(), 'officeweb-images-'));
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
    const outputPrefix = path.join(workDir, 'page');
    await execFileAsync(pdftoppm, [format === 'png' ? '-png' : '-jpeg', '-r', '150', pdfPath, outputPrefix], { timeout: 120_000, maxBuffer: 4 * 1024 * 1024 });
    const images = (await readdir(workDir)).filter((name) => name.startsWith('page-') && name.endsWith(format === 'png' ? '.png' : '.jpg')).sort();
    if (!images.length) throw new Error('没有生成图片');
    const zipPath = path.join(workDir, `${baseName}_${format}.zip`);
    await execFileAsync('zip', ['-j', zipPath, ...images.map((name) => path.join(workDir, name))], { maxBuffer: 4 * 1024 * 1024 });
    return new NextResponse(await readFile(zipPath), { headers: { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(path.basename(zipPath))}` } });
  } catch (error) {
    const unavailable = error?.code === 'ENOENT';
    return NextResponse.json({ error: unavailable ? '服务器缺少本地文档渲染组件' : (error.message || '文档转图片失败') }, { status: 500 });
  } finally {
    if (workDir) await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
