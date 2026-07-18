'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import messages from './messages';
import { DEFAULT_LOCALE, LOCALE_COOKIE, normalizeLocale } from './config';

const I18nContext = createContext(null);

function readPath(source, path) {
  return path.split('.').reduce((value, key) => value?.[key], source);
}

function interpolate(value, params) {
  return String(value).replace(/\{(\w+)\}/g, (_, key) => params[key] ?? `{${key}}`);
}

export function I18nProvider({ initialLocale = DEFAULT_LOCALE, children }) {
  const [locale, updateLocale] = useState(() => normalizeLocale(initialLocale));

  useEffect(() => { document.documentElement.lang = locale; }, [locale]);

  const setLocale = useCallback((nextLocale) => {
    const normalized = normalizeLocale(nextLocale);
    updateLocale(normalized);
    document.cookie = `${LOCALE_COOKIE}=${encodeURIComponent(normalized)}; path=/; max-age=31536000; samesite=lax`;
  }, []);

  const t = useCallback((key, params = {}) => {
    const value = readPath(messages[locale], key) ?? readPath(messages[DEFAULT_LOCALE], key) ?? key;
    return typeof value === 'string' ? interpolate(value, params) : value;
  }, [locale]);

  const value = useMemo(() => ({
    locale, setLocale, t,
    formatNumber: (number, options) => new Intl.NumberFormat(locale, options).format(number),
    formatDate: (date, options) => new Intl.DateTimeFormat(locale, options).format(new Date(date)),
  }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used inside I18nProvider');
  return context;
}
