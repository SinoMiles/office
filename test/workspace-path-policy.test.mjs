import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeWorkspacePath, previewType, resolveWorkspaceEntry } from '../lib/workspace/path-policy.js';

test('workspace paths reject traversal and unrelated absolute paths', () => {
  assert.throws(() => resolveWorkspaceEntry('/tmp/work', '../secret'), /PATH_OUTSIDE_WORKSPACE/);
  assert.throws(() => resolveWorkspaceEntry('/tmp/work', '/etc/passwd'), /PATH_OUTSIDE_WORKSPACE/);
  assert.equal(resolveWorkspaceEntry('/tmp/work', 'slides/report.pptx').candidate, '/tmp/work/slides/report.pptx');
});

test('macOS private temporary paths normalize to one identity', () => {
  assert.equal(normalizeWorkspacePath('/private/tmp/work/file.pptx'), '/tmp/work/file.pptx');
  assert.equal(normalizeWorkspacePath('/private/var/folders/a'), '/var/folders/a');
});

test('generic preview type covers common generated files', () => {
  assert.equal(previewType('report.pdf'), 'pdf');
  assert.equal(previewType('notes.md'), 'markdown');
  assert.equal(previewType('chart.png'), 'image');
  assert.equal(previewType('script.py'), 'text');
});
