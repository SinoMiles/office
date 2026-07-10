'use client';

import { ArrowRight, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toolCategories } from '@/lib/toolsData';

export default function ToolboxPage() {
  const router = useRouter();

  const handleToolClick = (tool) => {
    if (tool.comingSoon) return;
    
    if (tool.type === 'ai') {
      // Navigate to dashboard chat with the chosen intent
      router.push(`/dashboard?intent=${tool.id}`);
      return;
    }

    // Go to dedicated tool page
    router.push(`/tools/${tool.id}`);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)' }}>
      <div style={{ maxWidth: '1200px', margin: '40px auto 120px auto', padding: '0 24px', position: 'relative', zIndex: 2 }}>
        {toolCategories.map((category, idx) => (
          <div key={idx} style={{ marginBottom: '64px', animation: `slideUp ${0.5 + idx * 0.1}s ease-out` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: category.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {category.icon}
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>{category.title}</h2>
            </div>
            
            <div className="bento-grid">
              {category.tools.map((tool) => (
                <div 
                  key={tool.id} 
                  className="bento-col-3 premium-stat-card" 
                  style={{ 
                    cursor: tool.comingSoon ? 'not-allowed' : 'pointer',
                    opacity: tool.comingSoon ? 0.7 : 1,
                    position: 'relative',
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '180px',
                    border: '1px solid rgba(16, 185, 129, 0.1)'
                  }}
                  onClick={() => handleToolClick(tool)}
                >
                  {tool.comingSoon && (
                    <div style={{ position: 'absolute', top: '16px', right: '16px', fontSize: '0.7rem', padding: '4px 8px', background: '#f1f5f9', color: '#64748b', borderRadius: '8px', fontWeight: 600 }}>
                      Coming Soon
                    </div>
                  )}
                  <div>
                    <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', background: 'var(--background)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                      {tool.icon}
                    </div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '8px' }}>{tool.name}</h3>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>{tool.desc}</p>
                  </div>
                  
                  {!tool.comingSoon && (
                    <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', color: 'var(--primary)', opacity: 0, transition: 'opacity 0.2s', transform: 'translateX(-10px)', animation: 'none' }} className="tool-arrow">
                      <ArrowRight size={20} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
        
        <style dangerouslySetInnerHTML={{__html: `
          .premium-stat-card:hover .tool-arrow {
            opacity: 1 !important;
            transform: translateX(0) !important;
          }
        `}} />
      </div>
    </div>
  );
}
