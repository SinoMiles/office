'use client';

import { toolCategories } from '@/lib/toolsData';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft, Box } from 'lucide-react';

export default function ToolLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - 64px)', background: 'var(--background)' }}>
      {/* Sidebar */}
      <div style={{ 
        width: '280px', 
        background: 'white', 
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        position: 'sticky',
        top: '64px',
        height: 'calc(100vh - 64px)',
        overflowY: 'auto'
      }}>
        <div style={{ padding: '24px 20px', borderBottom: '1px solid var(--border)' }}>
          <button 
            onClick={() => router.push('/tools')}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              background: 'transparent', 
              border: 'none', 
              color: 'var(--text-muted)', 
              fontSize: '0.95rem', 
              fontWeight: 600,
              cursor: 'pointer',
              padding: '8px 12px',
              borderRadius: '8px',
              transition: 'all 0.2s',
              width: '100%'
            }}
            onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.05)'; e.currentTarget.style.color = 'var(--text-main)'; }}
            onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            <ArrowLeft size={18} /> 返回工具大厅
          </button>
        </div>

        <div style={{ padding: '20px' }}>
          {toolCategories.map((category, idx) => (
            <div key={idx} style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px', paddingLeft: '12px' }}>
                {category.title}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {category.tools.map(tool => {
                  const isActive = pathname === `/tools/${tool.id}`;
                  const targetUrl = `/tools/${tool.id}`;
                  
                  return (
                    <Link 
                      href={tool.comingSoon ? '#' : targetUrl}
                      key={tool.id}
                      style={{ 
                        textDecoration: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        background: isActive ? 'var(--primary-light)' : 'transparent',
                        color: isActive ? 'var(--primary)' : 'var(--text-main)',
                        fontWeight: isActive ? 600 : 500,
                        cursor: tool.comingSoon ? 'not-allowed' : 'pointer',
                        opacity: tool.comingSoon ? 0.6 : 1,
                        transition: 'all 0.2s'
                      }}
                      className={isActive ? '' : 'sidebar-tool-link'}
                      onClick={(e) => {
                        if (tool.comingSoon) e.preventDefault();
                      }}
                    >
                      <div style={{ 
                        width: '28px', height: '28px', 
                        borderRadius: '6px', 
                        background: isActive ? 'white' : 'var(--background)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                        boxShadow: isActive ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
                      }}>
                        {tool.icon}
                      </div>
                      <span style={{ fontSize: '0.95rem' }}>{tool.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        
        <style dangerouslySetInnerHTML={{__html: `
          .sidebar-tool-link:hover {
            background: rgba(0,0,0,0.03) !important;
          }
        `}} />
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {children}
      </div>
    </div>
  );
}
