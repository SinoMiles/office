export const LOCALE_COOKIE = 'office_locale';
export const LOCALE_EXPLICIT_COOKIE = 'office_locale_explicit';
export const DEFAULT_LOCALE = 'zh-CN';

export const SUPPORTED_LOCALES = [
  { code: 'zh-CN', label: '简体中文', short: '中' },
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'ja', label: '日本語', short: '日' },
  { code: 'ko', label: '한국어', short: '한' },
  { code: 'es', label: 'Español', short: 'ES' },
  { code: 'pt', label: 'Português', short: 'PT' },
  { code: 'fr', label: 'Français', short: 'FR' },
  { code: 'de', label: 'Deutsch', short: 'DE' },
];

export function normalizeLocale(value) {
  const locale = String(value || '').trim().toLowerCase().replace('_', '-');
  if (locale.startsWith('zh')) return 'zh-CN';
  return SUPPORTED_LOCALES.find(({ code }) => locale === code.toLowerCase() || locale.startsWith(`${code.toLowerCase()}-`))?.code || DEFAULT_LOCALE;
}
