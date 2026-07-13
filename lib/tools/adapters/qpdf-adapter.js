import { access, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { execFileAsync, output, withTempDir } from './shared';

export async function isQpdfAvailable() {
  try {
    await execFileAsync(process.env.QPDF_PATH || 'qpdf', ['--version'], { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

export async function protectPdf(file, password) {
  if (!password || password.length < 6) throw new Error('PDF 密码至少需要 6 个字符');
  const qpdf = process.env.QPDF_PATH || 'qpdf';
  return withTempDir('officeweb-qpdf-', async (workDir) => {
    const inputPath = path.join(workDir, 'input.pdf');
    const outputPath = path.join(workDir, 'protected.pdf');
    const jobPath = path.join(workDir, 'qpdf-job.json');
    await writeFile(inputPath, Buffer.from(await file.arrayBuffer()));
    await writeFile(jobPath, JSON.stringify({
      inputFile: inputPath,
      outputFile: outputPath,
      encrypt: {
        userPassword: password,
        ownerPassword: randomBytes(24).toString('base64url'),
        '256bit': { print: 'full', modify: 'none', extract: 'n', accessibility: 'y' },
      },
    }), { mode: 0o600 });
    await execFileAsync(qpdf, [`--job-json-file=${jobPath}`], { timeout: 120_000, maxBuffer: 4 * 1024 * 1024 });
    await access(outputPath);
    return output(await readFile(outputPath), 'protected.pdf', 'pdf');
  });
}
