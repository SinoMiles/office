import path from 'node:path';
import * as XLSX from 'xlsx';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export function isLegacyXls(filename) {
  return path.extname(String(filename || '')).toLowerCase() === '.xls';
}

export function convertedXlsxName(filename) {
  const parsed = path.parse(path.basename(String(filename || 'workbook.xls')));
  return `${parsed.name || 'workbook'}.xlsx`;
}

export function convertLegacyXls(buffer, filename = 'workbook.xls') {
  try {
    const workbook = XLSX.read(buffer, {
      type: 'buffer',
      cellDates: true,
      cellFormula: true,
      cellStyles: true,
      cellNF: true,
    });
    if (!workbook.SheetNames.length) throw new Error('工作簿中没有工作表');
    const output = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
      bookSST: true,
      compression: true,
      cellStyles: true,
    });
    return {
      buffer: Buffer.from(output),
      filename: convertedXlsxName(filename),
      mimeType: XLSX_MIME,
      sheetCount: workbook.SheetNames.length,
    };
  } catch (error) {
    throw new Error(`旧版 Excel 文件转换失败：${error.message}`);
  }
}
