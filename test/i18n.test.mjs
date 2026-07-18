import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, normalizeLocale } from '../app/i18n/config.js';
import messages from '../app/i18n/messages.js';

test('supports the eight phase-one locales', () => {
  assert.deepEqual(SUPPORTED_LOCALES.map(({ code }) => code), ['zh-CN', 'en', 'ja', 'ko', 'es', 'pt', 'fr', 'de']);
});

test('normalizes browser locale variants', () => {
  assert.equal(normalizeLocale('zh-TW,zh;q=0.9'), 'zh-CN');
  assert.equal(normalizeLocale('en-US,en;q=0.9'), 'en');
  assert.equal(normalizeLocale('pt-BR'), 'pt');
  assert.equal(normalizeLocale('unknown'), DEFAULT_LOCALE);
});

test('every locale contains shared navigation, footer and authentication sections', () => {
  for (const { code } of SUPPORTED_LOCALES) {
    assert.ok(messages[code]?.nav?.documents, `${code} navigation`);
    assert.ok(messages[code]?.footer?.terms, `${code} footer`);
    assert.ok(messages[code]?.auth?.login, `${code} authentication`);
    assert.ok(messages[code]?.dashboard?.billing, `${code} dashboard`);
  }
});
