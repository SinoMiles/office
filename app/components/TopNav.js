'use client';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PanelLeftClose } from 'lucide-react';
import LanguageSwitcher from './LanguageSwitcher';
import { useI18n } from '../i18n/I18nProvider';
import { localizedPath } from '../i18n/publicSeo';

export default function TopNav({ isLoggedIn }) {
  const pathname = usePathname();
  const isDashboard = pathname?.startsWith('/dashboard');
  const isAdmin = pathname?.startsWith('/admin');
  const [dashboardSidebarCollapsed, setDashboardSidebarCollapsed] = useState(false);
  const { locale, t } = useI18n();
  const homePath = localizedPath(locale, '/');

  useEffect(() => {
    const handleState = (event) => setDashboardSidebarCollapsed(Boolean(event.detail?.collapsed));
    window.addEventListener('office-sidebar-state', handleState);
    window.dispatchEvent(new CustomEvent('office-sidebar-query'));
    return () => window.removeEventListener('office-sidebar-state', handleState);
  }, []);

  const setSidebarCollapsed = (collapsed) => {
    setDashboardSidebarCollapsed(collapsed);
    window.dispatchEvent(new CustomEvent('office-sidebar-set', { detail: { collapsed } }));
  };

  // 后台管理系统有自己独立的侧边栏，不需要任何顶部导航
  if (isAdmin) {
    return null;
  }

  // 大厅内的极简导航
  if (isDashboard) {
    if (dashboardSidebarCollapsed) {
      return (
        <nav style={{ width: '72px', height: '70px', position: 'sticky', top: 0, zIndex: 50, background: '#f9f9f9', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'width 0.25s ease' }}>
          <button onClick={() => setSidebarCollapsed(false)} title={t('nav.expand')} aria-label={t('nav.expand')} style={{ width: '42px', height: '42px', border: 'none', borderRadius: '12px', padding: 0, background: 'transparent', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '1.5rem', fontWeight: 800 }}>
            ✦
          </button>
        </nav>
      );
    }
    return (
      <nav style={{ padding: '0 24px', position: 'sticky', top: 0, zIndex: 50, background: 'rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(0,0,0,0.05)', height: '70px', display: 'flex', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <button onClick={() => { window.location.href = homePath; }} style={{ fontSize: '1.25rem', fontWeight: 800, border: 'none', padding: 0, background: 'transparent', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', letterSpacing: '-0.5px', cursor: 'pointer' }} title="OfficeGPT 首页">
            <span style={{ color: 'var(--primary)', fontSize: '1.4rem' }}>✦</span> OfficeGPT
          </button>
        </div>
        <div style={{ marginLeft: 'auto' }}><LanguageSwitcher compact /></div>
        <button onClick={() => setSidebarCollapsed(true)} title={t('nav.collapse')} aria-label={t('nav.collapse')} style={{ width: '36px', height: '36px', position: 'absolute', left: '228px', border: 'none', background: 'rgba(255, 255, 255, 0.92)', color: 'var(--text-muted)', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
          <PanelLeftClose size={20} />
        </button>
      </nav>
    );
  }

  // 官网与普通页面的高级导航
  return (
    <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(255, 255, 255, 0.75)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(0,0,0,0.04)', height: '76px', display: 'flex', alignItems: 'center' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', width: '100%', padding: '0 24px', gap: '48px' }}>
        
        {/* Left: Logo */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Link href={homePath} style={{ fontSize: '1.35rem', fontWeight: 800, textDecoration: 'none', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', letterSpacing: '-0.5px', transition: 'opacity 0.2s' }} onMouseOver={e=>e.currentTarget.style.opacity='0.8'} onMouseOut={e=>e.currentTarget.style.opacity='1'}>
            <span style={{ color: 'var(--primary)', fontSize: '1.5rem' }}>✦</span> OfficeGPT
          </Link>
        </div>

        {/* Center: Menu */}
        <div style={{ display: 'flex', gap: '8px', fontSize: '0.95rem', fontWeight: 600 }}>
          <Link href="/tools" className="premium-nav-link" style={{ position: 'relative', display: 'flex', alignItems: 'center', padding: '8px 16px', borderRadius: '20px', textDecoration: 'none', color: pathname === '/tools' ? 'var(--primary)' : 'var(--text-main)', background: pathname === '/tools' ? 'var(--primary-light)' : 'transparent', transition: 'all 0.2s' }}>
            {t('nav.documents')}
            <span style={{ 
              position: 'absolute', 
              top: '-4px', 
              right: '-12px', 
              background: 'linear-gradient(135deg, #ff4e50, #f9d423)', 
              color: 'white', 
              fontSize: '0.65rem', 
              padding: '3px 8px', 
              borderRadius: '12px', 
              fontWeight: 800, 
              lineHeight: 1,
              boxShadow: '0 2px 6px rgba(255, 78, 80, 0.3)',
              transform: 'scale(0.9)',
              letterSpacing: '0.5px'
            }}>
              FREE
            </span>
          </Link>
          <Link href="/pricing" className="premium-nav-link" style={{ padding: '8px 16px', borderRadius: '20px', textDecoration: 'none', color: pathname === '/pricing' ? 'var(--primary)' : 'var(--text-main)', background: pathname === '/pricing' ? 'var(--primary-light)' : 'transparent', transition: 'all 0.2s' }}>{t('nav.pricing')}</Link>
          <Link href="/#features" className="premium-nav-link" style={{ padding: '8px 16px', borderRadius: '20px', textDecoration: 'none', color: 'var(--text-main)', transition: 'all 0.2s' }}>{t('nav.features')}</Link>
          <Link href="/#faq" className="premium-nav-link" style={{ padding: '8px 16px', borderRadius: '20px', textDecoration: 'none', color: 'var(--text-main)', transition: 'all 0.2s' }}>{t('nav.solutions')}</Link>
        </div>

        {/* Right: Actions */}
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-end', alignItems: 'center' }}>
          <LanguageSwitcher />
          {!isLoggedIn ? (
            <>
              <Link href="/login" style={{ textDecoration: 'none', color: 'var(--text-main)', fontWeight: 600, fontSize: '0.95rem', padding: '8px 16px', transition: 'color 0.2s' }} onMouseOver={e=>e.currentTarget.style.color='var(--primary)'} onMouseOut={e=>e.currentTarget.style.color='var(--text-main)'}>{t('nav.login')}</Link>
            </>
          ) : null}
        </div>
        
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        .premium-nav-link:hover {
          background: rgba(0,0,0,0.04) !important;
          color: var(--primary) !important;
        }
      `}} />
    </nav>
  );
}
