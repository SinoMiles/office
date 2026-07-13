import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import mammoth from 'mammoth';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { load } from 'cheerio';

export const runtime = 'nodejs';

const MIME = {
  txt: 'text/plain; charset=utf-8',
  csv: 'text/csv; charset=utf-8',
  json: 'application/json; charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  zip: 'application/zip',
  xls: 'application/vnd.ms-excel',
};

const execFileAsync = promisify(execFile);

function download(body, filename, type) {
  return new NextResponse(body, {
    headers: {
      'Content-Type': MIME[type],
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}

function workbookRows(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return { workbook, sheet, rows: XLSX.utils.sheet_to_json(sheet, { defval: '' }) };
}

function jsonRows(buffer) {
  const parsed = JSON.parse(buffer.toString('utf8'));
  if (!Array.isArray(parsed) || parsed.some((item) => !item || typeof item !== 'object' || Array.isArray(item))) {
    throw new Error('JSON 根节点必须是对象数组');
  }
  return parsed;
}

async function unzipEntries(buffer, filename, prefix) {
  const workDir = await mkdtemp(path.join(tmpdir(), 'officeweb-openxml-'));
  try {
    const inputPath = path.join(workDir, path.basename(filename));
    await writeFile(inputPath, buffer);
    const { stdout } = await execFileAsync('unzip', ['-Z1', inputPath], { maxBuffer: 4 * 1024 * 1024 });
    const entries = stdout.split('\n').filter((entry) => entry.startsWith(prefix) && !entry.endsWith('/'));
    return await Promise.all(entries.map(async (entry) => {
      const result = await execFileAsync('unzip', ['-p', inputPath, entry], { encoding: 'buffer', maxBuffer: 32 * 1024 * 1024 });
      return { entry, data: Buffer.from(result.stdout) };
    }));
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

async function zipBuffers(items, filename) {
  const workDir = await mkdtemp(path.join(tmpdir(), 'officeweb-zip-'));
  try {
    const paths = [];
    for (const [index, item] of items.entries()) {
      const target = path.join(workDir, `${String(index + 1).padStart(3, '0')}-${path.basename(item.name)}`);
      await writeFile(target, item.data);
      paths.push(target);
    }
    const zipPath = path.join(workDir, filename);
    await execFileAsync('zip', ['-j', zipPath, ...paths], { maxBuffer: 4 * 1024 * 1024 });
    return await readFile(zipPath);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

function xmlText(xml) {
  const $ = load(xml, { xmlMode: true });
  return $('a\\:t, w\\:t').map((_, node) => $(node).text()).get().join('\n');
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const action = String(formData.get('action') || '');
    const files = formData.getAll('files');
    const file = files[0];
    if (!file) return NextResponse.json({ error: '请上传文件' }, { status: 400 });
    const buffer = Buffer.from(await file.arrayBuffer());
    const baseName = String(file.name || 'document').replace(/\.[^.]+$/, '');

    if (action === 'pdf-to-text') {
      const result = await pdfParse(buffer);
      return download(result.text.trim(), `${baseName}.txt`, 'txt');
    }
    if (action === 'word-to-text') {
      const result = await mammoth.extractRawText({ buffer });
      return download(result.value.trim(), `${baseName}.txt`, 'txt');
    }
    if (action === 'ppt-to-text' || action === 'ppt-notes-extract') {
      const prefix = action === 'ppt-to-text' ? 'ppt/slides/slide' : 'ppt/notesSlides/notesSlide';
      const entries = await unzipEntries(buffer, file.name, prefix);
      const text = entries.map((entry, index) => `--- ${action === 'ppt-to-text' ? '幻灯片' : '备注'} ${index + 1} ---\n${xmlText(entry.data.toString('utf8'))}`).join('\n\n');
      return download(text.trim(), `${baseName}_${action === 'ppt-to-text' ? 'slides' : 'notes'}.txt`, 'txt');
    }
    if (action === 'word-images-extract' || action === 'ppt-images-extract') {
      const prefix = action === 'word-images-extract' ? 'word/media/' : 'ppt/media/';
      const entries = await unzipEntries(buffer, file.name, prefix);
      if (!entries.length) return NextResponse.json({ error: '文档中没有可提取的图片' }, { status: 400 });
      const zip = await zipBuffers(entries.map((entry) => ({ name: path.basename(entry.entry), data: entry.data })), `${baseName}_images.zip`);
      return download(zip, `${baseName}_images.zip`, 'zip');
    }

    if (action === 'excel-to-csv') {
      const { sheet } = workbookRows(buffer);
      return download(`\uFEFF${XLSX.utils.sheet_to_csv(sheet)}`, `${baseName}.csv`, 'csv');
    }
    if (action === 'excel-to-json') {
      const { rows } = workbookRows(buffer);
      return download(JSON.stringify(rows, null, 2), `${baseName}.json`, 'json');
    }
    if (action === 'csv-to-json') {
      const workbook = XLSX.read(buffer.toString('utf8').replace(/^\uFEFF/, ''), { type: 'string', raw: false });
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' });
      return download(JSON.stringify(rows, null, 2), `${baseName}.json`, 'json');
    }
    if (action === 'csv-to-excel') {
      const workbook = XLSX.read(buffer.toString('utf8').replace(/^\uFEFF/, ''), { type: 'string', raw: false });
      return download(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }), `${baseName}.xlsx`, 'xlsx');
    }
    if (action === 'json-to-csv') {
      const sheet = XLSX.utils.json_to_sheet(jsonRows(buffer));
      return download(`\uFEFF${XLSX.utils.sheet_to_csv(sheet)}`, `${baseName}.csv`, 'csv');
    }
    if (action === 'json-to-excel') {
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(jsonRows(buffer)), 'Data');
      return download(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }), `${baseName}.xlsx`, 'xlsx');
    }
    if (action === 'xls-to-xlsx' || action === 'xlsx-to-xls') {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const type = action === 'xls-to-xlsx' ? 'xlsx' : 'xls';
      return download(XLSX.write(workbook, { type: 'buffer', bookType: type === 'xlsx' ? 'xlsx' : 'biff8' }), `${baseName}.${type}`, type);
    }
    if (action === 'excel-merge') {
      const allRows = [];
      for (const uploaded of files) {
        const rows = workbookRows(Buffer.from(await uploaded.arrayBuffer())).rows;
        allRows.push(...rows);
      }
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(allRows), 'Merged');
      return download(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }), 'merged.xlsx', 'xlsx');
    }
    if (action === 'excel-split-sheets') {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const outputs = workbook.SheetNames.map((sheetName) => {
        const output = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(output, workbook.Sheets[sheetName], sheetName.slice(0, 31));
        return { name: `${sheetName.replace(/[^\p{L}\p{N}._-]+/gu, '_') || 'Sheet'}.xlsx`, data: XLSX.write(output, { type: 'buffer', bookType: 'xlsx' }) };
      });
      return download(await zipBuffers(outputs, `${baseName}_sheets.zip`), `${baseName}_sheets.zip`, 'zip');
    }
    if (action === 'excel-workbook-summary' || action === 'excel-formula-audit') {
      const workbook = XLSX.read(buffer, { type: 'buffer', cellFormula: true });
      const sheets = workbook.SheetNames.map((name) => {
        const sheet = workbook.Sheets[name];
        const range = sheet['!ref'] ? XLSX.utils.decode_range(sheet['!ref']) : null;
        const formulas = Object.entries(sheet).filter(([cell, value]) => !cell.startsWith('!') && value?.f).map(([cell, value]) => ({ cell, formula: value.f, value: value.v }));
        return { name, rows: range ? range.e.r - range.s.r + 1 : 0, columns: range ? range.e.c - range.s.c + 1 : 0, formulas };
      });
      const payload = action === 'excel-formula-audit' ? { file: file.name, formulaCount: sheets.reduce((total, sheet) => total + sheet.formulas.length, 0), sheets: sheets.map(({ name, formulas }) => ({ name, formulas })) } : { file: file.name, sheetCount: sheets.length, sheets: sheets.map(({ formulas, ...sheet }) => ({ ...sheet, formulaCount: formulas.length })) };
      return download(JSON.stringify(payload, null, 2), `${baseName}_${action === 'excel-formula-audit' ? 'formulas' : 'summary'}.json`, 'json');
    }
    if (action === 'excel-dedupe-columns') {
      const columns = String(formData.get('columns') || '').split(/[,，]/).map((item) => item.trim()).filter(Boolean);
      if (!columns.length) return NextResponse.json({ error: '请输入用于去重的列名' }, { status: 400 });
      const { rows } = workbookRows(buffer);
      const missing = columns.filter((column) => rows.length && !(column in rows[0]));
      if (missing.length) return NextResponse.json({ error: `找不到列：${missing.join('、')}` }, { status: 400 });
      const outputRows = [...new Map(rows.map((row) => [JSON.stringify(columns.map((column) => row[column])), row])).values()];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(outputRows), 'Deduplicated');
      return download(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }), `${baseName}_deduplicated.xlsx`, 'xlsx');
    }
    if (action === 'excel-dedupe' || action === 'excel-clean') {
      const { rows } = workbookRows(buffer);
      const cleaned = rows.filter((row) => Object.values(row).some((value) => String(value).trim() !== ''));
      const outputRows = action === 'excel-dedupe'
        ? [...new Map(cleaned.map((row) => [JSON.stringify(row), row])).values()]
        : cleaned;
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(outputRows), 'Cleaned');
      return download(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }), `${baseName}_cleaned.xlsx`, 'xlsx');
    }

    return NextResponse.json({ error: '不支持的文档处理操作' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error.message || '文件处理失败' }, { status: 500 });
  }
}
