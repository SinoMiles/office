import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildConversationExtra,
  isExplicitFileGenerationRequest,
  OFFICEWEB_AGENT_CONTEXT,
} from '../lib/aioncore/request-policy.js';

test('content and outline requests stay in the chat response', () => {
  assert.equal(isExplicitFileGenerationRequest('请帮我写一份年度述职 PPT 的详细大纲'), false);
  assert.equal(isExplicitFileGenerationRequest('生成一段用于首页的内容'), false);
  assert.equal(isExplicitFileGenerationRequest('总结这份报告的核心观点'), false);
});

test('explicit Office file requests opt into the file workflow', () => {
  assert.equal(isExplicitFileGenerationRequest('生成ppt'), true);
  assert.equal(isExplicitFileGenerationRequest('请把上面内容制作成 PPTX 文件'), true);
  assert.equal(isExplicitFileGenerationRequest('导出为年度报告.docx'), true);
});

test('conversation extra carries hidden response policy and excludes automatic officecli injection', () => {
  const extra = buildConversationExtra({ workspace: '/tmp/workspace' });
  assert.equal(extra.workspace, '/tmp/workspace');
  assert.equal(extra.context, OFFICEWEB_AGENT_CONTEXT);
  assert.deepEqual(extra.exclude_auto_inject_skills, ['officecli']);
});

