import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const execFileAsync = promisify(execFile);
const ALLOWED_EXTENSIONS = new Set(['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx']);

export async function POST(req) {
  let workDir;
  try {
    const formData = await req.formData();
    const file = formData.get('file');
    const extension = path.extname(file?.name || '').toLowerCase();
    if (!file || !ALLOWED_EXTENSIONS.has(extension)) {
      return NextResponse.json({ error: '请上传 Word、Excel 或 PowerPoint 文件' }, { status: 400 });
    }

    workDir = await mkdtemp(path.join(tmpdir(), 'officeweb-convert-'));
    const safeBaseName = path.basename(file.name, extension).replace(/[^\p{L}\p{N}._-]+/gu, '_') || 'document';
    const inputPath = path.join(workDir, `${safeBaseName}${extension}`);
    await writeFile(inputPath, Buffer.from(await file.arrayBuffer()));

    const soffice = process.env.LIBREOFFICE_PATH || 'soffice';
    const profileUrl = `file://${path.join(workDir, 'libreoffice-profile')}`;
    await execFileAsync(soffice, [`-env:UserInstallation=${profileUrl}`, '--headless', '--convert-to', 'pdf', '--outdir', workDir, inputPath], {
      timeout: 120_000,
      maxBuffer: 4 * 1024 * 1024,
    });

    const pdfBytes = await readFile(path.join(workDir, `${safeBaseName}.pdf`));
    const downloadName = `${path.basename(file.name, extension)}.pdf`;
    return new NextResponse(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`,
      },
    });
  } catch (error) {
    const unavailable = error?.code === 'ENOENT';
    return NextResponse.json({ error: unavailable ? '服务器尚未安装 LibreOffice，暂时无法转换' : '文件转换失败，请检查文件是否完整' }, { status: 500 });
  } finally {
    if (workDir) await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
