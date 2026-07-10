'use client';

import { ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toolCategories } from '@/lib/toolsData';
import Footer from '@/app/components/Footer';

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
    <div style={{ minHeight: '100vh', background: 'var(--background)', position: 'relative', overflow: 'hidden' }}>
      {/* Decorative Background Effects */}
      <div style={{ position: 'absolute', top: '-10%', left: '50%', transform: 'translateX(-50%)', width: '80%', height: '500px', background: 'radial-gradient(ellipse at center, rgba(16, 185, 129, 0.15) 0%, rgba(255,255,255,0) 70%)', zIndex: 0, pointerEvents: 'none' }}></div>
      <div style={{ position: 'absolute', top: '10%', right: '10%', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(59, 130, 246, 0.1) 0%, rgba(255,255,255,0) 70%)', zIndex: 0, pointerEvents: 'none', filter: 'blur(40px)' }}></div>
      
      {/* Hero Section */}
      <div style={{ position: 'relative', zIndex: 2, padding: '80px 24px 60px 24px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '3.5rem', fontWeight: 800, marginBottom: '24px', letterSpacing: '-1px', background: 'linear-gradient(135deg, var(--text-main) 0%, #475569 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          全能文档处理大厅
        </h1>
        <p style={{ fontSize: '1.2rem', color: 'var(--text-muted)', maxWidth: '600px', margin: '0 auto', lineHeight: 1.6 }}>
          探索为现代办公量身打造的极速处理工具。无论是格式转换还是 AI 深度排版，均在完全安全的沙盒环境中瞬间完成。
        </p>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto 120px auto', padding: '0 24px', position: 'relative', zIndex: 2 }}>
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
      <Footer />
    </div>
  );
}
