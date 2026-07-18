'use client';

import { ArrowRight, Search, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toolCategories } from '@/lib/toolsData';
import Footer from '@/app/components/Footer';
import { useI18n } from '@/app/i18n/I18nProvider';
import { localizedToolName } from '@/app/i18n/toolNames';

const categoryLabels = {
  'zh-CN': ['格式极速转换', '表格与数据转换', 'PDF 实用工具箱', 'AI 智能文档处理'],
  en: ['Fast format conversion', 'Spreadsheet & data conversion', 'PDF utilities', 'AI document processing'],
  ja: ['高速形式変換', '表計算・データ変換', 'PDF ユーティリティ', 'AI 文書処理'],
  ko: ['빠른 형식 변환', '스프레드시트 및 데이터 변환', 'PDF 유틸리티', 'AI 문서 처리'],
  es: ['Conversión rápida de formatos', 'Conversión de hojas y datos', 'Utilidades PDF', 'Procesamiento de documentos con IA'],
  pt: ['Conversão rápida de formatos', 'Conversão de planilhas e dados', 'Utilitários PDF', 'Processamento de documentos com IA'],
  fr: ['Conversion rapide de formats', 'Conversion de feuilles et données', 'Utilitaires PDF', 'Traitement de documents par IA'],
  de: ['Schnelle Formatkonvertierung', 'Tabellen- und Datenkonvertierung', 'PDF-Werkzeuge', 'KI-Dokumentverarbeitung'],
};

export default function ToolboxPage() {
  const router = useRouter();
  const { locale, t } = useI18n();
  const [query, setQuery] = useState('');
  const visibleCategories = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const localized = toolCategories.map((category, index) => ({ ...category, title: categoryLabels[locale]?.[index] || category.title, tools: category.tools.map((tool) => ({ ...tool, displayName: localizedToolName(tool, locale) })) }));
    if (!keyword) return localized;
    return localized.map((category) => ({ ...category, tools: category.tools.filter((tool) => `${tool.displayName} ${tool.desc}`.toLowerCase().includes(keyword)) })).filter((category) => category.tools.length > 0);
  }, [locale, query]);
  const availableCount = toolCategories.reduce((count, category) => count + category.tools.filter((tool) => !tool.comingSoon).length, 0);

  const handleToolClick = (tool) => {
    if (tool.comingSoon) return;
    
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
          {t('tools.title')}
        </h1>
        <p style={{ fontSize: '1.2rem', color: 'var(--text-muted)', maxWidth: '600px', margin: '0 auto', lineHeight: 1.6 }}>
          {t('tools.subtitle', { count: availableCount })}
        </p>
        <div style={{ maxWidth: '620px', margin: '32px auto 0', position: 'relative' }}>
          <Search size={20} style={{ position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('tools.search')} aria-label={t('tools.searchLabel')} style={{ width: '100%', padding: '16px 20px 16px 52px', borderRadius: '18px', border: '1px solid var(--border)', background: 'rgba(255,255,255,.9)', boxShadow: '0 14px 40px rgba(15,23,42,.08)', fontSize: '1rem', outline: 'none' }} />
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto 120px auto', padding: '0 24px', position: 'relative', zIndex: 2 }}>
        {visibleCategories.map((category, idx) => (
          <div id={`tool-category-${idx}`} key={category.title} style={{ marginBottom: '64px', animation: `slideUp ${0.5 + idx * 0.1}s ease-out`, scrollMarginTop: '96px' }}>
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
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '8px' }}>{tool.displayName}</h3>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>{locale === 'zh-CN' ? tool.desc : t('tools.genericSummary', { name: tool.displayName })}</p>
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
        {visibleCategories.length === 0 ? <div style={{ textAlign: 'center', padding: '70px 20px', color: 'var(--text-muted)' }}><Search size={34} style={{ marginBottom: '14px' }} /><p>{t('tools.empty')}</p><button onClick={() => router.push('/dashboard')} className="btn btn-primary">{t('tools.askAi')}</button></div> : null}
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
