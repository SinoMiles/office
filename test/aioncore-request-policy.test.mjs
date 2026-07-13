import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildConversationExtra,
  OFFICEWEB_AGENT_CONTEXT,
  buildOfficeWebAgentContext,
} from '../lib/aioncore/request-policy.js';

test('conversation extra carries hidden response policy and clears automatic-skill exclusions', () => {
  const extra = buildConversationExtra({ workspace: '/tmp/workspace' });
  assert.equal(extra.workspace, '/tmp/workspace');
  assert.equal(extra.context, OFFICEWEB_AGENT_CONTEXT);
  assert.equal(extra.product_locale, 'zh-CN');
  assert.deepEqual(extra.exclude_auto_inject_skills, []);
});

test('agent language policy follows the latest user message with a locale fallback', () => {
  const context = buildOfficeWebAgentContext('en-US');
  assert.match(context, /same language as the user's most recent message/);
  assert.match(context, /thinking\/status narration/);
  assert.match(context, /Product locale fallback: en-US/);
  const extra = buildConversationExtra({ product_locale: 'ja-JP' });
  assert.equal(extra.product_locale, 'ja-JP');
  assert.match(extra.context, /Product locale fallback: ja-JP/);
});
