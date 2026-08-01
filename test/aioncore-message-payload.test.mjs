import assert from 'node:assert/strict';
import test from 'node:test';

import { buildAioncoreMessagePayload } from '../lib/aioncore/message-payload.js';

test('builds latest AionCore upload file references', () => {
  assert.deepEqual(
    buildAioncoreMessagePayload({
      content: '分析工作簿',
      attachments: [
        { filename: '工作簿.xlsx', uploadPath: 'C:\\Temp\\aionui\\会话\\工作簿.xlsx' },
        { filename: '说明.pdf', uploadPath: 'C:\\Temp\\aionui\\会话\\说明.pdf' },
      ],
    }),
    {
      content: '分析工作簿',
      files: [
        { kind: 'upload', path: 'C:\\Temp\\aionui\\会话\\工作簿.xlsx' },
        { kind: 'upload', path: 'C:\\Temp\\aionui\\会话\\说明.pdf' },
      ],
    },
  );
});

test('builds an empty file list for text-only messages', () => {
  assert.deepEqual(buildAioncoreMessagePayload({ content: '继续' }), {
    content: '继续',
    files: [],
  });
});

test('rejects a persisted workspace path as an upload reference', () => {
  assert.throws(
    () => buildAioncoreMessagePayload({
      content: '分析工作簿',
      attachments: [{ filename: '工作簿.xlsx', filePath: 'D:\\workspace\\工作簿.xlsx' }],
    }),
    /AIONCORE_UPLOAD_PATH_REQUIRED/,
  );
});
