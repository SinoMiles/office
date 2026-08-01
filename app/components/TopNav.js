'use client';
import { usePathname } from 'next/navigation';
import BrandMark from '@/app/components/BrandMark';
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
  const [scrolled, setScrolled] = useState(false);
  const { locale, t } = useI18n();
  const homePath = localizedPath(locale, '/');
  const toolsPath = localizedPath(locale, '/tools');
  const loginPath = localizedPath(locale, '/login');

  // 浏览器地址栏里带语言前缀（/zh-cn、/en），而链接写的是不带前缀的路径。
  // 之前直接拿 pathname === '/tools' 比较，永远不成立，选中态从来没亮过。
  const routePath = (pathname || '/').replace(/^\/(zh-cn|en)(?=\/|$)/, '') || '/';
  const isHome = routePath === '/';
  const usesDarkNav = isHome || routePath === '/login';

  useEffect(() => {
    const handleState = (event) => setDashboardSidebarCollapsed(Boolean(event.detail?.collapsed));
    window.addEventListener('office-sidebar-state', handleState);
    window.dispatchEvent(new CustomEvent('office-sidebar-query'));
    return () => window.removeEventListener('office-sidebar-state', handleState);
  }, []);

  // 置顶时导航是透明的，滚动后才变成磨砂玻璃。passive 避免阻塞滚动。
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
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
          <button onClick={() => setSidebarCollapsed(false)} title={t('nav.expand')} aria-label={t('nav.expand')} style={{ width: '42px', height: '42px', border: 'none', borderRadius: '12px', padding: 0, background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <BrandMark size={28} />
          </button>
        </nav>
      );
    }
    return (
      <nav style={{ padding: '0 24px', position: 'sticky', top: 0, zIndex: 50, background: 'rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(0,0,0,0.05)', height: '70px', display: 'flex', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <button onClick={() => { window.location.href = homePath; }} style={{ fontSize: '1.25rem', fontWeight: 800, border: 'none', padding: 0, background: 'transparent', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', letterSpacing: '-0.5px', cursor: 'pointer' }} title="OfficeGPT 首页">
            <BrandMark size={26} /> OfficeGPT
          </button>
        </div>
        <div style={{ marginLeft: 'auto' }}><LanguageSwitcher compact /></div>
        <button onClick={() => setSidebarCollapsed(true)} title={t('nav.collapse')} aria-label={t('nav.collapse')} style={{ width: '36px', height: '36px', position: 'absolute', left: '228px', border: 'none', background: 'rgba(255, 255, 255, 0.92)', color: 'var(--text-muted)', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
          <PanelLeftClose size={20} />
        </button>
      </nav>
    );
  }

  // 官网与普通页面的高级导航。
  // 首页整屏顶部是深色 Hero，导航因此常驻深色主题：置顶全透明浮在 Hero 上，
  // 滚动后转深色磨砂（若切成白玻璃，会在深色 Hero 上闪出一条白条）。
  // 其余页面底色是浅的，用常规的白色磨砂玻璃。
  const overHero = usesDarkNav && !scrolled;
  const navClass = `site-nav${usesDarkNav ? ' on-dark' : ''}${overHero ? '' : ' is-glass'}`;

  return (
    <nav className={navClass}>
      <div className="site-nav-inner" style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', width: '100%', padding: '0 24px', gap: '48px' }}>

        {/* Left: Logo */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Link href={homePath} className="nav-brand" style={{ fontSize: '1.35rem', fontWeight: 800, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', letterSpacing: '-0.5px' }}>
            <BrandMark size={28} /> OfficeGPT
          </Link>
        </div>

        {/* Center: Menu */}
        <div className="site-nav-menu" style={{ display: 'flex', gap: '8px', fontSize: '0.95rem', fontWeight: 600 }}>
          <Link href={toolsPath} className="premium-nav-link" style={{ position: 'relative', display: 'flex', alignItems: 'center', padding: '8px 16px', borderRadius: '20px', textDecoration: 'none', ...(routePath.startsWith('/tools') ? { color: 'var(--primary)', background: overHero ? 'rgba(110,231,183,.14)' : 'var(--primary-light)' } : null) }}>
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
          <Link href={`${homePath}#features`} className="premium-nav-link" style={{ padding: '8px 16px', borderRadius: '20px', textDecoration: 'none' }}>{t('nav.features')}</Link>
          <Link href={`${homePath}#faq`} className="premium-nav-link" style={{ padding: '8px 16px', borderRadius: '20px', textDecoration: 'none' }}>{t('nav.solutions')}</Link>
        </div>

        {/* Right: Actions */}
        <div className="site-nav-actions" style={{ display: 'flex', gap: '16px', justifyContent: 'flex-end', alignItems: 'center' }}>
          <LanguageSwitcher compact />
          {!isLoggedIn ? (
            <>
              <Link href={loginPath} className="nav-login" style={{ textDecoration: 'none', fontWeight: 600, fontSize: '0.95rem', padding: '8px 16px' }}>{t('nav.login')}</Link>
            </>
          ) : null}
        </div>
        
      </div>
      {/* hover 样式已移到 globals.css 的 .premium-nav-link，
          那里能跟着导航的深浅两种状态切换配色 */}
    </nav>
  );
}
