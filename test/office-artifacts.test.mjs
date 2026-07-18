import assert from 'node:assert/strict';
import test from 'node:test';
import { attachArtifactsToMessages, taskArtifactViews } from '../lib/office/artifacts.js';

test('creates one preview identity per artifact', () => {
  const task = {
    _id: 'task-1',
    status: 'completed',
    artifacts: [
      { _id: 'ppt-1', filename: '方案.pptx', filePath: '/work/方案.pptx', fileType: 'pptx', status: 'ready' },
      { _id: 'xls-1', filename: '数据.xlsx', filePath: '/work/数据.xlsx', fileType: 'xlsx', status: 'ready' },
    ],
  };
  const views = taskArtifactViews(task);
  assert.deepEqual(views.map((item) => item.id), ['task-1:ppt-1', 'task-1:xls-1']);
  assert.equal(views[1].previewUrl, '/api/tasks/task-1/office-preview/proxy/xls-1/');
  assert.match(views[0].downloadUrl, /artifactId=ppt-1/);
});

test('non-Office artifacts use the generic workspace preview', () => {
  const [view] = taskArtifactViews({
    _id: 'task-md',
    artifacts: [{ _id: 'md-1', filename: '大纲.md', filePath: '/work/大纲.md', fileType: 'markdown', status: 'ready' }],
  });
  assert.equal(view.generic, true);
  assert.equal(view.previewType, 'markdown');
  assert.match(view.previewUrl, /workspace\/file\?path=/);
});

test('keeps legacy outputFile compatible', () => {
  const [view] = taskArtifactViews({ _id: 'old-task', outputFile: '/work/old.docx', outputFilename: 'old.docx' });
  assert.equal(view.id, 'old-task:legacy');
  assert.equal(view.previewUrl, '/api/tasks/old-task/office-preview/proxy/');
});

test('attaches each turn files to its assistant message', () => {
  const messages = [{ role: 'user' }, { role: 'ai' }, { role: 'user' }, { role: 'ai' }];
  const turns = [
    { _id: 'one', artifacts: [{ _id: 'a', filename: 'a.pptx', filePath: '/a.pptx' }] },
    { _id: 'two', artifacts: [{ _id: 'b', filename: 'b.xlsx', filePath: '/b.xlsx' }] },
  ];
  const result = attachArtifactsToMessages(messages, turns);
  assert.equal(result[1].artifacts[0].filename, 'a.pptx');
  assert.equal(result[3].artifacts[0].filename, 'b.xlsx');
});

test('restores uploaded attachments onto historical user messages', () => {
  const messages = [{ role: 'user', content: '分析文件' }, { role: 'ai', content: '完成' }];
  const turns = [{
    _id: 'upload-turn',
    filename: 'legacy.xlsx',
    attachments: [{ filename: '成绩统计表.xlsx', filePath: '/tmp/成绩统计表.xlsx' }],
  }];
  const result = attachArtifactsToMessages(messages, turns);
  assert.deepEqual(result[0].filenames, ['成绩统计表.xlsx']);
  assert.equal(result[0].filename, '成绩统计表.xlsx');
  assert.equal(result[0].attachments[0].previewUrl, '/api/tasks/upload-turn/office-preview/attachment/0/');
});
