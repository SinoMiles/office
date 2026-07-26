'use client';

import { usePathname } from 'next/navigation';
import BrandMark from '@/app/components/BrandMark';
import { BarChart3, Users, Settings, Receipt } from 'lucide-react';
import Link from 'next/link';

export default function AdminSidebar({ user }) {
  const pathname = usePathname();

  const links = [
    { href: '/admin', icon: BarChart3, label: '数据统计' },
    { href: '/admin/users', icon: Users, label: '用户管理' },
    { href: '/admin/orders', icon: Receipt, label: '订单管理' },
    { href: '/admin/settings', icon: Settings, label: '系统设置' },
  ];

  return (
    <aside style={{ 
      width: '280px', 
      background: 'rgba(255, 255, 255, 0.8)', 
      backdropFilter: 'blur(20px)',
      borderRight: '1px solid rgba(0,0,0,0.05)', 
      display: 'flex', 
      flexDirection: 'column',
      boxShadow: '4px 0 24px rgba(0,0,0,0.02)'
    }}>
      <div style={{ padding: '32px 24px', fontSize: '1.4rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <BrandMark size={36} radius={10} />
        OfficeGPT <span style={{ fontSize: '0.75rem', background: 'var(--primary-light)', padding: '4px 8px', borderRadius: '12px', color: 'var(--primary)', fontWeight: '600' }}>Admin</span>
      </div>
      
      <nav style={{ flex: 1, padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ padding: '0 12px', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Overview
        </div>
        {links.map((link) => {
          const isActive = pathname === link.href;
          return (
            <Link 
              key={link.href} 
              href={link.href}
              style={{
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px', 
                padding: '14px 16px', 
                borderRadius: '16px', 
                color: isActive ? 'var(--primary)' : 'var(--text-muted)', 
                background: isActive ? 'var(--primary-light)' : 'transparent',
                textDecoration: 'none', 
                fontWeight: isActive ? 600 : 500,
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative',
                overflow: 'hidden'
              }}
              onMouseOver={e => !isActive && (e.currentTarget.style.background = 'rgba(0,0,0,0.02)')}
              onMouseOut={e => !isActive && (e.currentTarget.style.background = 'transparent')}
            >
              {isActive && (
                <div style={{ position: 'absolute', left: 0, top: '20%', bottom: '20%', width: '4px', background: 'var(--primary)', borderRadius: '0 4px 4px 0' }} />
              )}
              <link.icon size={20} /> {link.label}
            </Link>
          );
        })}
      </nav>
      
      <div style={{ padding: '24px', borderTop: '1px solid rgba(0,0,0,0.05)', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        OfficeGPT Admin &copy; {new Date().getFullYear()}
      </div>
    </aside>
  );
}
