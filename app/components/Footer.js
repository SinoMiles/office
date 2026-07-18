'use client';
import React from 'react';
import Link from 'next/link';
import { useI18n } from '../i18n/I18nProvider';

export default function Footer() {
  const { t } = useI18n();
  return (
    <footer style={{ background: '#0a0f1c', color: '#94a3b8', padding: '100px 24px 40px 24px', zIndex: 10, position: 'relative' }}>
      <div className="container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '48px', marginBottom: '80px', maxWidth: '1200px', margin: '0 auto 80px auto' }}>
        <div style={{ maxWidth: '300px' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', color: 'white', marginBottom: '24px' }}>
            <span style={{ color: 'var(--primary)' }}>✦</span>
            OfficeGPT
          </div>
          <p style={{ lineHeight: 1.6, fontSize: '0.95rem' }}>{t('footer.summary')}</p>
        </div>
        <div>
          <h4 style={{ color: 'white', marginBottom: '24px', fontSize: '1.1rem' }}>{t('footer.products')}</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '0.95rem' }}>
            <Link href="/#solutions" style={{ textDecoration: 'none', color: 'inherit', transition: 'color 0.2s' }}>{t('footer.workflow')}</Link>
            <Link href="/#pricing" style={{ textDecoration: 'none', color: 'inherit', transition: 'color 0.2s' }}>{t('footer.billing')}</Link>
            <Link href="/docs" style={{ textDecoration: 'none', color: 'inherit', transition: 'color 0.2s' }}>{t('footer.docs')}</Link>
          </div>
        </div>
        <div>
          <h4 style={{ color: 'white', marginBottom: '24px', fontSize: '1.1rem' }}>{t('footer.legal')}</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '0.95rem' }}>
            <Link href="/about" style={{ textDecoration: 'none', color: 'inherit', transition: 'color 0.2s' }}>{t('footer.about')}</Link>
            <Link href="/privacy" style={{ textDecoration: 'none', color: 'inherit', transition: 'color 0.2s' }}>{t('footer.privacy')}</Link>
            <Link href="/terms" style={{ textDecoration: 'none', color: 'inherit', transition: 'color 0.2s' }}>{t('footer.terms')}</Link>
          </div>
        </div>
      </div>
      <div className="container" style={{ borderTop: '1px solid #1e293b', paddingTop: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '18px', fontSize: '0.9rem', maxWidth: '1200px', margin: '0 auto' }}>
        <div>{t('footer.rights')}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', fontSize: '0.85rem' }}>
          <Link href="/terms" style={{ color: 'inherit', textDecoration: 'none' }}>{t('footer.terms')}</Link>
          <Link href="/privacy" style={{ color: 'inherit', textDecoration: 'none' }}>{t('footer.privacy')}</Link>
        </div>
      </div>
    </footer>
  );
}
