'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Languages } from 'lucide-react';
import { SUPPORTED_LOCALES } from '../i18n/config';
import { useI18n } from '../i18n/I18nProvider';
import { localeSegments } from '../i18n/publicSeo';

export default function LanguageSwitcher({ compact = false }) {
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const current = SUPPORTED_LOCALES.find((item) => item.code === locale) || SUPPORTED_LOCALES[0];

  useEffect(() => {
    const close = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  const chooseLocale = (code) => {
    setLocale(code);
    setOpen(false);
    const parts = window.location.pathname.split('/').filter(Boolean);
    const currentSegment = Object.values(localeSegments).includes(parts[0]?.toLowerCase()) ? parts.shift() : null;
    const publicRoot = parts[0] || '';
    if (currentSegment || ['', 'tools', 'about', 'docs', 'privacy', 'terms', 'login', 'register', 'forgot-password'].includes(publicRoot)) {
      window.location.assign(`/${localeSegments[code]}/${parts.join('/')}`.replace(/\/$/, '') || `/${localeSegments[code]}`);
    }
  };

  return (
    <div ref={rootRef} style={{ position: 'relative', zIndex: 80 }}>
      <button
        type="button"
        aria-label={t('language.select')}
        aria-haspopup="menu"
        aria-expanded={open}
        // 供顶部导航在透明态下覆盖配色使用（见 globals.css 的 .site-nav.is-over-hero）
        className="language-switcher-trigger"
        onClick={() => setOpen((value) => !value)}
        style={{
          height: 38,
          minWidth: compact ? 68 : 112,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: compact ? 6 : 8,
          padding: compact ? '0 10px' : '0 12px',
          border: `1px solid ${open ? 'rgba(16, 185, 129, .48)' : 'rgba(148, 163, 184, .28)'}`,
          borderRadius: 12,
          background: open ? 'rgba(236, 253, 245, .96)' : 'rgba(255, 255, 255, .88)',
          boxShadow: open ? '0 0 0 3px rgba(16, 185, 129, .09)' : '0 2px 8px rgba(15, 23, 42, .04)',
          color: open ? 'var(--primary)' : 'var(--text-main)',
          cursor: 'pointer',
          transition: 'border-color .18s ease, background .18s ease, box-shadow .18s ease',
        }}
      >
        <Languages size={17} strokeWidth={2} aria-hidden="true" />
        <span style={{ fontSize: '0.82rem', fontWeight: 700, lineHeight: 1, whiteSpace: 'nowrap' }}>{compact ? current.short : current.label}</span>
        <ChevronDown size={14} aria-hidden="true" style={{ color: 'var(--text-muted)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .18s ease' }} />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={t('language.select')}
          style={{
            position: 'absolute',
            top: 'calc(100% + 10px)',
            right: 0,
            width: 280,
            padding: 8,
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 4,
            background: 'rgba(255, 255, 255, .98)',
            border: '1px solid rgba(148, 163, 184, .2)',
            borderRadius: 16,
            boxShadow: '0 18px 45px rgba(15, 23, 42, .14), 0 4px 12px rgba(15, 23, 42, .06)',
            backdropFilter: 'blur(18px)',
          }}
        >
          {SUPPORTED_LOCALES.map((item) => {
            const selected = item.code === locale;
            return (
              <button
                key={item.code}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                onClick={() => chooseLocale(item.code)}
                style={{
                  minWidth: 0,
                  height: 44,
                  padding: '0 10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  border: 0,
                  borderRadius: 10,
                  background: selected ? 'var(--primary-light)' : 'transparent',
                  color: selected ? 'var(--primary)' : 'var(--text-main)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background .15s ease, color .15s ease',
                }}
                onMouseEnter={(event) => { if (!selected) event.currentTarget.style.background = 'rgba(15, 23, 42, .045)'; }}
                onMouseLeave={(event) => { if (!selected) event.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ width: 28, height: 28, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: 8, background: selected ? 'white' : 'rgba(148, 163, 184, .11)', fontSize: '0.68rem', fontWeight: 800, letterSpacing: '-.02em' }}>{item.short}</span>
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.82rem', fontWeight: selected ? 700 : 550 }}>{item.label}</span>
                {selected && <Check size={15} strokeWidth={2.5} aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
