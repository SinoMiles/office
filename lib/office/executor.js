import path from 'node:path';
import fs from 'node:fs/promises';
import officecli from '@officecli/sdk';

const FORMATS = new Set(['pptx', 'docx', 'xlsx']);
const COMMANDS = new Set(['add', 'set', 'remove', 'get', 'query', 'view']);
const MAX_OPERATIONS = 300;

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
    return {
      command: item.command,
      path: item.path,
      ...(cleanMap(item.args, 'args') ? { args: cleanMap(item.args, 'args') } : {}),
      ...(cleanMap(item.props, 'props') ? { props: cleanMap(item.props, 'props') } : {}),
    };
  });
}

export async function executeOfficePlan({ taskDir, format, filename, operations }) {
  if (!FORMATS.has(format)) throw new Error('Unsupported Office format');
  const targetName = safeFilename(filename, format);
  const filePath = path.join(taskDir, targetName);
  const previewPath = path.join(taskDir, 'preview.html');
  const safeOperations = validateOperations(operations);

  await fs.mkdir(taskDir, { recursive: true });
  const document = await officecli.create(filePath, ['--force'], {
    timeoutMs: 120_000,
    autoInstall: true,
  });

  try {
    const result = await document.batch(safeOperations, {
      force: true,
      stopOnError: true,
      timeoutMs: 180_000,
    });
    if (result?.success === false) {
      throw new Error(result.error?.message || 'OfficeCLI rejected the document plan');
    }
    const html = await document.send({ command: 'view', args: { mode: 'html' } }, false, 120_000);
    if (typeof html !== 'string' || !html.includes('<')) throw new Error('OfficeCLI did not return an HTML preview');
    await fs.writeFile(previewPath, html, 'utf8');
  } finally {
    await document.close();
  }

  return { filename: targetName, filePath, previewPath, operationCount: safeOperations.length };
}

