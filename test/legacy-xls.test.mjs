import assert from 'node:assert/strict';
import test from 'node:test';
import * as XLSX from 'xlsx';
import { convertLegacyXls, convertedXlsxName, isLegacyXls } from '../lib/office/legacy-xls.js';

test('legacy xls detection only matches the old workbook extension', () => {
  assert.equal(isLegacyXls('销售数据.XLS'), true);
  assert.equal(isLegacyXls('销售数据.xlsx'), false);
  assert.equal(convertedXlsxName('销售数据.xls'), '销售数据.xlsx');
});

test('legacy xls conversion preserves worksheets, Chinese text, and numeric values', () => {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ['名称', '金额', '合计'],
    ['测试', 12, 24],
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, '销售明细');
  const legacy = XLSX.write(workbook, { type: 'buffer', bookType: 'biff8' });
  const converted = convertLegacyXls(legacy, '工作簿.xls');
  const result = XLSX.read(converted.buffer, { type: 'buffer', cellFormula: true });
  assert.equal(converted.filename, '工作簿.xlsx');
  assert.equal(converted.mimeType, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  assert.deepEqual(result.SheetNames, ['销售明细']);
  assert.equal(result.Sheets['销售明细'].A2.v, '测试');
  assert.equal(result.Sheets['销售明细'].B2.v, 12);
  assert.equal(result.Sheets['销售明细'].C2.v, 24);
});
