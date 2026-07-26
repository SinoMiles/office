import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_LOCALE, RETIRED_LOCALE_SEGMENTS, SUPPORTED_LOCALES, normalizeLocale } from '../app/i18n/config.js';
import messages from '../app/i18n/messages.js';
import TOOL_SEO_EN from '../app/i18n/toolSeoEn.js';

test('ships only the locales that have hand-written content', () => {
  // 曾经上线过 8 个语种，但其中 6 个的工具正文与 FAQ 都是同一套通用模板，
  // 对搜索引擎构成重复内容。收缩到中英双语是刻意为之，不要在没有真实文案前加回来。
  assert.deepEqual(SUPPORTED_LOCALES.map(({ code }) => code), ['zh-CN', 'en']);
});

test('retired locales are still recognised so old links can be redirected', () => {
  assert.deepEqual(RETIRED_LOCALE_SEGMENTS, ['ja', 'ko', 'es', 'pt', 'fr', 'de']);
  // 已下线语种不能重新出现在支持列表里，否则 proxy 的 301 分支会被绕过。
  const supported = new Set(SUPPORTED_LOCALES.map(({ code }) => code));
  for (const segment of RETIRED_LOCALE_SEGMENTS) assert.ok(!supported.has(segment), `${segment} 不应同时是支持语种`);
});

test('normalizes browser locale variants', () => {
  assert.equal(normalizeLocale('zh-TW,zh;q=0.9'), 'zh-CN');
  assert.equal(normalizeLocale('en-US,en;q=0.9'), 'en');
  assert.equal(normalizeLocale(''), DEFAULT_LOCALE);
  assert.equal(normalizeLocale(null), DEFAULT_LOCALE);
});

test('unsupported languages fall back to English rather than Chinese', () => {
  // 一个巴西用户看到中文界面比看到英文界面糟糕得多。
  for (const tag of ['pt-BR', 'de-DE', 'fr', 'ko-KR', 'ja']) {
    assert.equal(normalizeLocale(tag), 'en', `${tag} 应退回英文`);
  }
});

test('every locale contains shared navigation, footer and authentication sections', () => {
  for (const { code } of SUPPORTED_LOCALES) {
    assert.ok(messages[code]?.nav?.documents, `${code} navigation`);
    assert.ok(messages[code]?.nav?.pricing, `${code} pricing nav`);
    assert.ok(messages[code]?.footer?.terms, `${code} footer`);
    assert.ok(messages[code]?.auth?.login, `${code} authentication`);
    assert.ok(messages[code]?.dashboard?.billing, `${code} dashboard`);
  }
});

test('every tool has hand-written English SEO copy', async () => {
  // 英文站的价值全靠这份文案。少一个工具就多一个薄页面，因此在测试里锁死。
  const source = await import('node:fs').then(({ readFileSync }) => readFileSync('lib/toolsData.js', 'utf8'));
  const toolIds = [...source.matchAll(/\{ id: '([a-z0-9-]+)'/g)].map((match) => match[1]);
  assert.ok(toolIds.length >= 50, `期望至少 50 个工具，实际 ${toolIds.length}`);
  const missing = toolIds.filter((id) => !TOOL_SEO_EN[id]);
  assert.deepEqual(missing, [], `缺少英文文案的工具: ${missing.join(', ')}`);
});

test('English tool copy is distinct per tool, not templated', () => {
  const summaries = Object.values(TOOL_SEO_EN).map((entry) => entry.summary);
  assert.equal(new Set(summaries).size, summaries.length, '存在重复的英文摘要');
  for (const [id, entry] of Object.entries(TOOL_SEO_EN)) {
    assert.ok(entry.name?.length > 2, `${id} 缺少英文名称`);
    assert.ok(entry.summary?.length > 80, `${id} 的摘要过短，不足以支撑索引`);
    assert.equal(entry.useCases?.length, 3, `${id} 应有 3 条使用场景`);
    assert.ok(entry.faqs?.length >= 2, `${id} 至少需要 2 条 FAQ`);
    for (const [question, answer] of entry.faqs) {
      assert.ok(question?.length > 5 && answer?.length > 20, `${id} 的 FAQ 内容过短`);
    }
  }
});
