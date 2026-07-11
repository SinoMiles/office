import path from 'node:path';
import fs from 'node:fs/promises';
import officecli from '@officecli/sdk';
import { load as loadHtml } from 'cheerio';

const FORMATS = new Set(['pptx', 'docx', 'xlsx']);
const COMMANDS = new Set(['add', 'set', 'remove', 'get', 'query', 'view']);
const MAX_OPERATIONS = 300;
const PREVIEW_BATCH_SIZE = 8;

function safeFilename(value, format) {
  const base = path.basename(String(value || `document.${format}`))
    .replace(/[^\p{L}\p{N}._-]+/gu, '_')
    .slice(0, 100);
  return base.toLowerCase().endsWith(`.${format}`) ? base : `${base}.${format}`;
}

function cleanMap(value, field) {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${field} must be an object`);
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => {
      if (!/^[a-zA-Z0-9_.-]{1,64}$/.test(key)) throw new Error(`Invalid ${field} key: ${key}`);
      if (!['string', 'number', 'boolean'].includes(typeof item)) {
        throw new Error(`${field}.${key} must be a scalar`);
      }
      return [key, item];
    }),
  );
}

function validateOperations(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_OPERATIONS) {
    throw new Error(`operations must contain 1-${MAX_OPERATIONS} items`);
  }
  return value.map((item, index) => {
    if (!item || typeof item !== 'object' || !COMMANDS.has(item.command)) {
      throw new Error(`Invalid operation at index ${index}`);
    }
    if (typeof item.path !== 'string' || !item.path.startsWith('/') || item.path.includes('..')) {
      throw new Error(`Invalid Office path at index ${index}`);
    }
    const args = cleanMap(item.args, 'args');
    const props = cleanMap(item.props, 'props');
    return {
      command: item.command,
      path: item.path,
      ...(args ? { args } : {}),
      ...(props ? { props } : {}),
    };
  });
}

async function renderOfficePreview(document, previewPath) {
  // Keep the renderer identical to OfficeCLI: its `view html` command is the
  // only source of preview HTML. The web app merely serves this output.
  const html = await document.send({ command: 'view', args: { mode: 'html' } }, false, 120_000);
  if (typeof html !== 'string' || !html.includes('<')) {
    throw new Error('Core engine did not return an HTML preview');
  }
  const temporaryPath = `${previewPath}.next`;
  await fs.writeFile(temporaryPath, html, 'utf8');
  await fs.rename(temporaryPath, previewPath);
}

export async function extractOfficeText(filePath) {
  const document = await officecli.open(filePath, { timeoutMs: 120_000, autoInstall: true });
  try {
    const html = await document.send({ command: 'view', args: { mode: 'html' } }, false, 120_000);
    return typeof html === 'string' ? loadHtml(html).text().replace(/\s+/g, ' ').trim() : '';
  } finally {
    await document.close();
  }
}

export async function executeOfficePlan({ taskDir, format, filename, operations, sourceFile, onProgress = () => {}, isCancelled = () => false }) {
  if (!FORMATS.has(format)) throw new Error('Unsupported Office format');
  const sourceFormat = path.extname(sourceFile || '').slice(1).toLowerCase();
  const targetFormat = FORMATS.has(sourceFormat) ? sourceFormat : format;
  const targetName = safeFilename(filename, targetFormat);
  const filePath = path.join(taskDir, targetName);
  const previewPath = path.join(taskDir, 'preview.html');
  const safeOperations = validateOperations(operations);

  await fs.mkdir(taskDir, { recursive: true });
  if (sourceFile) await fs.copyFile(sourceFile, filePath);
  const document = sourceFile
    ? await officecli.open(filePath, { timeoutMs: 120_000, autoInstall: true })
    : await officecli.create(filePath, ['--force'], { timeoutMs: 120_000, autoInstall: true });

  try {
    onProgress({ type: 'tool', id: 'officecli', title: 'OfficeCLI 正在创建可编辑文件', status: 'running' });
    for (let start = 0; start < safeOperations.length; start += PREVIEW_BATCH_SIZE) {
      if (isCancelled()) throw new Error('任务已取消');
      const batch = safeOperations.slice(start, start + PREVIEW_BATCH_SIZE);
      const result = await document.batch(batch, {
        force: true,
        stopOnError: true,
        timeoutMs: 180_000,
      });
      if (result?.success === false) {
        throw new Error(result.error?.message || 'Core engine rejected the document plan');
      }
      const completed = Math.min(start + batch.length, safeOperations.length);
      onProgress({
        type: 'progress',
        id: 'office-write',
        title: '正在写入文档内容与排版',
        detail: `已执行 ${completed}/${safeOperations.length} 项 OfficeCLI 操作`,
        status: 'running',
        current: completed,
        total: safeOperations.length,
      });
      await renderOfficePreview(document, previewPath);
      if (isCancelled()) throw new Error('任务已取消');
      onProgress({
        type: 'preview',
        id: 'office-preview',
        title: 'OfficeCLI 已刷新实时预览',
        detail: `已渲染 ${completed}/${safeOperations.length} 项操作`,
        status: completed === safeOperations.length ? 'completed' : 'running',
        current: completed,
        total: safeOperations.length,
      });
    }
    onProgress({ type: 'tool', id: 'officecli', title: 'OfficeCLI 已完成文件生成', status: 'completed' });
  } finally {
    await document.close();
  }

  return { filename: targetName, filePath, previewPath, operationCount: safeOperations.length };
}
