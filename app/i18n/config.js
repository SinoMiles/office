export const LOCALE_COOKIE = 'office_locale';
export const LOCALE_EXPLICIT_COOKIE = 'office_locale_explicit';
export const DEFAULT_LOCALE = 'zh-CN';

// 只保留有真实本地化内容的语种。此前的 8 语种里有 6 种只是把工具名按连字符机械拼词，
// 正文与 FAQ 全部复用同一套通用模板 —— 350 个近乎重复的页面属于 Google 定义的
// doorway pages，有降权风险。等某个语种的工具文案真正写完再加回来。
export const SUPPORTED_LOCALES = [
  { code: 'zh-CN', label: '简体中文', short: '中' },
  { code: 'en', label: 'English', short: 'EN' },
];

// 已下线的语种：仍要识别，以便把历史链接 301 到英文版而不是丢 404。
export const RETIRED_LOCALE_SEGMENTS = ['ja', 'ko', 'es', 'pt', 'fr', 'de'];

export function normalizeLocale(value) {
  const locale = String(value || '').trim().toLowerCase().replace('_', '-');
  if (!locale) return DEFAULT_LOCALE;
  if (locale.startsWith('zh')) return 'zh-CN';
  const supported = SUPPORTED_LOCALES.find(({ code }) => locale === code.toLowerCase() || locale.startsWith(`${code.toLowerCase()}-`));
  if (supported) return supported.code;
  // 收缩语种后，非中文浏览器落到中文界面体验很差 —— 只要能识别出是某种语言标签，
  // 就退回英文；完全无法识别的输入才用默认语言。
  return /^[a-z]{2,3}(-|$)/.test(locale) ? 'en' : DEFAULT_LOCALE;
}
