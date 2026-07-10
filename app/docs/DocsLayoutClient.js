'use client';

import { docsData } from '@/lib/docsData';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function DocsLayout({ children }) {
  const pathname = usePathname();

  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - 64px)', background: 'var(--background)' }}>
      {/* Docs Sidebar */}
      <aside style={{ 
        width: '280px', 
        background: 'white', 
        borderRight: '1px solid var(--border)',
        padding: '24px',
        position: 'sticky',
        top: '64px',
        height: 'calc(100vh - 64px)',
        overflowY: 'auto'
      }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '24px', color: 'var(--text-main)' }}>
          帮助文档中心
        </h2>
        
        {docsData.map((category, idx) => (
          <div key={idx} style={{ marginBottom: '24px' }}>
            <div style={{ 
              fontSize: '0.8rem', 
              fontWeight: 700, 
              color: 'var(--text-muted)', 
              textTransform: 'uppercase', 
              letterSpacing: '0.5px', 
              marginBottom: '12px',
              paddingLeft: '8px'
            }}>
              {category.category}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {category.items.map(item => {
                const isActive = pathname === `/docs/${item.slug}`;
                return (
                  <Link 
                    href={`/docs/${item.slug}`}
                    key={item.slug}
                    style={{ 
                      textDecoration: 'none',
                      display: 'block',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: isActive ? 'var(--primary-light)' : 'transparent',
                      color: isActive ? 'var(--primary)' : 'var(--text-main)',
                      fontWeight: isActive ? 600 : 500,
                      transition: 'all 0.2s',
                      fontSize: '0.95rem'
                    }}
                    onMouseOver={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'rgba(0,0,0,0.03)';
                      }
                    }}
                    onMouseOut={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                  >
                    {item.title}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </aside>

      {/* Docs Content Area */}
      <main style={{ flex: 1, padding: '48px', overflowY: 'auto', background: 'white' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          {children}
        </div>
      </main>
    </div>
  );
}
