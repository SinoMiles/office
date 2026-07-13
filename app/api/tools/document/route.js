import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import mammoth from 'mammoth';

export const runtime = 'nodejs';

const MIME = {
  txt: 'text/plain; charset=utf-8',
  csv: 'text/csv; charset=utf-8',
  json: 'application/json; charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

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

export async function POST(request) {
  try {
    const formData = await request.formData();
    const action = String(formData.get('action') || '');
    const file = formData.get('files');
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

    if (action === 'excel-to-csv') {
      const { sheet } = workbookRows(buffer);
      return download(`\uFEFF${XLSX.utils.sheet_to_csv(sheet)}`, `${baseName}.csv`, 'csv');
    }
    if (action === 'excel-to-json') {
      const { rows } = workbookRows(buffer);
      return download(JSON.stringify(rows, null, 2), `${baseName}.json`, 'json');
    }
    if (action === 'csv-to-json') {
      const workbook = XLSX.read(buffer, { type: 'buffer', raw: false });
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' });
      return download(JSON.stringify(rows, null, 2), `${baseName}.json`, 'json');
    }
    if (action === 'csv-to-excel') {
      const workbook = XLSX.read(buffer, { type: 'buffer', raw: false });
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
