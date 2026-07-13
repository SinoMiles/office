import * as XLSX from 'xlsx';
import { output, zipBuffers } from './shared';

const ACTIONS = new Set(['excel-to-csv', 'excel-to-json', 'csv-to-json', 'csv-to-excel', 'json-to-csv', 'json-to-excel', 'xls-to-xlsx', 'xlsx-to-xls', 'excel-merge', 'excel-split-sheets', 'excel-workbook-summary', 'excel-formula-audit', 'excel-dedupe-columns', 'excel-dedupe', 'excel-clean']);

function workbookRows(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return { sheet, rows: XLSX.utils.sheet_to_json(sheet, { defval: '' }) };
}

function jsonRows(buffer) {
  const parsed = JSON.parse(buffer.toString('utf8'));
  if (!Array.isArray(parsed) || parsed.some((item) => !item || typeof item !== 'object' || Array.isArray(item))) throw new Error('JSON 根节点必须是对象数组');
  return parsed;
}

function rowsWorkbook(rows, sheetName) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), sheetName);
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

export function supportsSheetAction(action) {
  return ACTIONS.has(action);
}

export async function processSheet({ action, files, file, buffer, baseName, formData }) {
  if (action === 'excel-to-csv') return output(`\uFEFF${XLSX.utils.sheet_to_csv(workbookRows(buffer).sheet)}`, `${baseName}.csv`, 'csv');
  if (action === 'excel-to-json') return output(JSON.stringify(workbookRows(buffer).rows, null, 2), `${baseName}.json`, 'json');
  if (action === 'csv-to-json' || action === 'csv-to-excel') {
    const workbook = XLSX.read(buffer.toString('utf8').replace(/^\uFEFF/, ''), { type: 'string', raw: false });
    if (action === 'csv-to-excel') return output(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }), `${baseName}.xlsx`, 'xlsx');
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' });
    return output(JSON.stringify(rows, null, 2), `${baseName}.json`, 'json');
  }
  if (action === 'json-to-csv') return output(`\uFEFF${XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(jsonRows(buffer)))}`, `${baseName}.csv`, 'csv');
  if (action === 'json-to-excel') return output(rowsWorkbook(jsonRows(buffer), 'Data'), `${baseName}.xlsx`, 'xlsx');
  if (action === 'xls-to-xlsx' || action === 'xlsx-to-xls') {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const type = action === 'xls-to-xlsx' ? 'xlsx' : 'xls';
    return output(XLSX.write(workbook, { type: 'buffer', bookType: type === 'xlsx' ? 'xlsx' : 'biff8' }), `${baseName}.${type}`, type);
  }
  if (action === 'excel-merge') {
    const allRows = [];
    for (const uploaded of files) allRows.push(...workbookRows(Buffer.from(await uploaded.arrayBuffer())).rows);
    return output(rowsWorkbook(allRows, 'Merged'), 'merged.xlsx', 'xlsx');
  }
  if (action === 'excel-split-sheets') {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const outputs = workbook.SheetNames.map((sheetName) => {
      const split = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(split, workbook.Sheets[sheetName], sheetName.slice(0, 31));
      return { name: `${sheetName.replace(/[^\p{L}\p{N}._-]+/gu, '_') || 'Sheet'}.xlsx`, data: XLSX.write(split, { type: 'buffer', bookType: 'xlsx' }) };
    });
    return output(await zipBuffers(outputs, `${baseName}_sheets.zip`), `${baseName}_sheets.zip`, 'zip');
  }
  if (action === 'excel-workbook-summary' || action === 'excel-formula-audit') {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellFormula: true });
    const sheets = workbook.SheetNames.map((name) => {
      const sheet = workbook.Sheets[name];
      const range = sheet['!ref'] ? XLSX.utils.decode_range(sheet['!ref']) : null;
      const formulas = Object.entries(sheet).filter(([cell, value]) => !cell.startsWith('!') && value?.f).map(([cell, value]) => ({ cell, formula: value.f, value: value.v }));
      return { name, rows: range ? range.e.r - range.s.r + 1 : 0, columns: range ? range.e.c - range.s.c + 1 : 0, formulas };
    });
    const formulaAudit = action === 'excel-formula-audit';
    const payload = formulaAudit ? { file: file.name, formulaCount: sheets.reduce((total, sheet) => total + sheet.formulas.length, 0), sheets: sheets.map(({ name, formulas }) => ({ name, formulas })) } : { file: file.name, sheetCount: sheets.length, sheets: sheets.map(({ formulas, ...sheet }) => ({ ...sheet, formulaCount: formulas.length })) };
    return output(JSON.stringify(payload, null, 2), `${baseName}_${formulaAudit ? 'formulas' : 'summary'}.json`, 'json');
  }
  const { rows } = workbookRows(buffer);
  if (action === 'excel-dedupe-columns') {
    const columns = String(formData.get('columns') || '').split(/[,，]/).map((item) => item.trim()).filter(Boolean);
    if (!columns.length) throw new Error('请输入用于去重的列名');
    const missing = columns.filter((column) => rows.length && !(column in rows[0]));
    if (missing.length) throw new Error(`找不到列：${missing.join('、')}`);
    const deduped = [...new Map(rows.map((row) => [JSON.stringify(columns.map((column) => row[column])), row])).values()];
    return output(rowsWorkbook(deduped, 'Deduplicated'), `${baseName}_deduplicated.xlsx`, 'xlsx');
  }
  const cleaned = rows.filter((row) => Object.values(row).some((value) => String(value).trim() !== ''));
  const result = action === 'excel-dedupe' ? [...new Map(cleaned.map((row) => [JSON.stringify(row), row])).values()] : cleaned;
  return output(rowsWorkbook(result, 'Cleaned'), `${baseName}_cleaned.xlsx`, 'xlsx');
}
