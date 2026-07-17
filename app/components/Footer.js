'use client';
import React from 'react';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer style={{ background: '#0a0f1c', color: '#94a3b8', padding: '100px 24px 40px 24px', zIndex: 10, position: 'relative' }}>
      <div className="container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '48px', marginBottom: '80px', maxWidth: '1200px', margin: '0 auto 80px auto' }}>
        <div style={{ maxWidth: '300px' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', color: 'white', marginBottom: '24px' }}>
            <span style={{ color: 'var(--primary)' }}>✦</span>
            OfficeGPT
          </div>
          <p style={{ lineHeight: 1.6, fontSize: '0.95rem' }}>基于最新大语言模型驱动的下一代数据处理与办公自动化 SaaS 平台。</p>
        </div>
        <div>
          <h4 style={{ color: 'white', marginBottom: '24px', fontSize: '1.1rem' }}>产品与服务</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '0.95rem' }}>
            <Link href="/#solutions" style={{ textDecoration: 'none', color: 'inherit', transition: 'color 0.2s' }}>核心工作流</Link>
            <Link href="/#pricing" style={{ textDecoration: 'none', color: 'inherit', transition: 'color 0.2s' }}>按量计费方案</Link>
            <Link href="/docs" style={{ textDecoration: 'none', color: 'inherit', transition: 'color 0.2s' }}>帮助文档中心</Link>
          </div>
        </div>
        <div>
          <h4 style={{ color: 'white', marginBottom: '24px', fontSize: '1.1rem' }}>法律与支持</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '0.95rem' }}>
            <Link href="/about" style={{ textDecoration: 'none', color: 'inherit', transition: 'color 0.2s' }}>关于我们</Link>
            <Link href="/privacy" style={{ textDecoration: 'none', color: 'inherit', transition: 'color 0.2s' }}>隐私政策</Link>
            <Link href="/terms" style={{ textDecoration: 'none', color: 'inherit', transition: 'color 0.2s' }}>服务条款</Link>
          </div>
        </div>
      </div>
      <div className="container" style={{ borderTop: '1px solid #1e293b', paddingTop: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '18px', fontSize: '0.9rem', maxWidth: '1200px', margin: '0 auto' }}>
        <div>© 2026 深圳市星尚硕教育科技有限公司 保留所有权利.</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', fontSize: '0.85rem' }}>
          <Link href="/terms" style={{ color: 'inherit', textDecoration: 'none' }}>服务条款</Link>
          <Link href="/privacy" style={{ color: 'inherit', textDecoration: 'none' }}>隐私政策</Link>
        </div>
      </div>
    </footer>
  );
}
