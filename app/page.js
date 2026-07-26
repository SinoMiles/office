'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Zap, Table, FileArchive, Sparkles, ShieldCheck, Upload, MessageSquare, Download } from 'lucide-react';
import Footer from './components/Footer';
import FAQ from './components/FAQ';
import { useI18n } from './i18n/I18nProvider';
import { homeCopy } from './i18n/homeCopy';

const CATEGORY_VISUALS = [
  { icon: Zap, tint: '#f59e0b', soft: 'rgba(245, 158, 11, 0.12)', href: '/tools#tool-category-0' },
  { icon: Table, tint: '#10b981', soft: 'rgba(16, 185, 129, 0.12)', href: '/tools#tool-category-1' },
  { icon: FileArchive, tint: '#3b82f6', soft: 'rgba(59, 130, 246, 0.12)', href: '/tools#tool-category-2' },
  { icon: Sparkles, tint: '#8b5cf6', soft: 'rgba(139, 92, 246, 0.12)', href: '/tools#tool-category-3' },
];

const STEP_ICONS = [Upload, MessageSquare, Download];

export default function LandingPage() {
  const { locale } = useI18n();
  const copy = homeCopy[locale] || homeCopy['zh-CN'];

  return (
    <main style={{ overflowX: 'hidden' }}>
      {/* ---------------- Hero ---------------- */}
      <section className="hero-dark" style={{ padding: '132px 0 120px' }}>
        <div className="hero-aurora" aria-hidden="true" />
        <div className="hero-grid" aria-hidden="true" />
        <div className="hero-fade" aria-hidden="true" />

        <div className="container" style={{ position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.05fr) minmax(0, 1fr)', gap: '64px', alignItems: 'center' }}>
            <div style={{ animation: 'slideUp .6s ease-out' }}>
              <span className="hero-eyebrow">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '3px 9px', borderRadius: '999px', background: 'rgba(16,185,129,.18)', color: '#6ee7b7', fontSize: '0.72rem', fontWeight: 700 }}>
                  <ShieldCheck size={12} /> LIVE
                </span>
                {copy.badge}
              </span>

              <h1 className="hero-title">
                {copy.hero[0]}
                <br />
                <span className="hero-accent">{copy.hero[1]}</span>
              </h1>

              <p className="hero-sub">{copy.hero[2]}</p>

              <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginTop: '38px' }}>
                <a href="/api/auth/entry" className="btn-hero btn-hero-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '9px' }}>
                  {copy.hero[3]} <ArrowRight size={18} />
                </a>
                <Link href="/tools" className="btn-hero btn-hero-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: '9px' }}>
                  {copy.heroSecondary}
                </Link>
              </div>

              <div className="hero-stats">
                {copy.stats.map(([value, label]) => (
                  <div className="hero-stat" key={label}>
                    <b>{value}</b>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 产品实拍。原来这里是一张会持续 3D 浮动的图，观感晃眼；
                改为静态窗口 + 深色描边，让截图本身成为主角。 */}
            <div style={{ animation: 'slideUp .8s ease-out' }}>
              <div className="hero-shot">
                <div className="hero-shot-bar">
                  <span className="hero-shot-dot" style={{ background: '#ff5f57' }} />
                  <span className="hero-shot-dot" style={{ background: '#febc2e' }} />
                  <span className="hero-shot-dot" style={{ background: '#28c840' }} />
                  <span style={{ marginLeft: '12px', fontSize: '0.75rem', color: '#7f8ea8', fontFamily: 'ui-monospace, monospace' }}>officegpt.cn/dashboard</span>
                </div>
                <Image
                  src="/hero-demo.jpg"
                  alt="OfficeGPT workspace"
                  width={1200}
                  height={750}
                  priority
                  style={{ width: '100%', height: 'auto', display: 'block' }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- 能力总览 ---------------- */}
      <section style={{ padding: '104px 0', background: 'var(--background)' }}>
        <div className="container">
          <div style={{ maxWidth: '720px', marginBottom: '52px' }}>
            <span className="section-eyebrow">{copy.catalog[0]}</span>
            <h2 className="section-title">{copy.catalog[1]}</h2>
            <p className="section-sub">{copy.catalog[2]}</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(268px, 1fr))', gap: '20px' }}>
            {copy.categories.map(([title, desc, chips], index) => {
              const visual = CATEGORY_VISUALS[index] || CATEGORY_VISUALS[0];
              const Icon = visual.icon;
              return (
                <Link key={title} href={visual.href} className="cat-card">
                  <span style={{ display: 'inline-flex', width: '46px', height: '46px', borderRadius: '13px', background: visual.soft, color: visual.tint, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={22} />
                  </span>
                  <h3 style={{ fontSize: '1.12rem', fontWeight: 700, margin: '18px 0 9px' }}>{title}</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', lineHeight: 1.7, margin: '0 0 16px' }}>{desc}</p>
                  <div>{chips.map((chip) => <span className="cat-chip" key={chip}>{chip}</span>)}</div>
                </Link>
              );
            })}
          </div>

          <div style={{ marginTop: '36px' }}>
            <Link href="/tools" className="btn btn-outline" style={{ padding: '12px 22px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              {copy.catalogCta} <ArrowUpRight size={17} />
            </Link>
          </div>
        </div>
      </section>

      {/* ---------------- 工作流 ---------------- */}
      <section id="features" style={{ padding: '104px 0', background: 'var(--surface)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div className="container">
          <div style={{ maxWidth: '720px', marginBottom: '52px' }}>
            <span className="section-eyebrow">{copy.workflow[0]}</span>
            <h2 className="section-title">{copy.workflow[1]}</h2>
            <p className="section-sub">{copy.workflow[2]}</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            {copy.steps.map(([title, desc], index) => {
              const Icon = STEP_ICONS[index] || Upload;
              return (
                <div className="step-card" key={title}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
                    <span style={{ display: 'inline-flex', width: '44px', height: '44px', borderRadius: '12px', background: 'var(--primary-light)', color: 'var(--primary-hover)', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon size={21} />
                    </span>
                    <span className="step-index">{String(index + 1).padStart(2, '0')}</span>
                  </div>
                  <h3 style={{ fontSize: '1.12rem', fontWeight: 700, marginBottom: '10px' }}>{title}</h3>
                  <p style={{ color: 'var(--text-muted)', lineHeight: 1.75, fontSize: '0.94rem', margin: 0 }}>{desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ---------------- 定价引导 ----------------
          原来首页内嵌了一份硬编码的套餐卡，和 /pricing 页读取的真实套餐
          目录会各说各话。这里只保留导流，价格以 /pricing 为唯一口径。 */}
      <section id="pricing" style={{ padding: '104px 0', background: 'var(--background)' }}>
        <div className="container">
          <div style={{ position: 'relative', overflow: 'hidden', borderRadius: '26px', padding: 'clamp(38px, 5vw, 62px)', background: 'linear-gradient(135deg, #0b1220 0%, #16233c 55%, #10362f 100%)', color: '#e8edf7' }}>
            <div aria-hidden="true" style={{ position: 'absolute', top: '-40%', right: '-10%', width: '520px', height: '520px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,.30), transparent 65%)' }} />
            <div style={{ position: 'relative', zIndex: 1, maxWidth: '760px' }}>
              <span style={{ display: 'inline-block', padding: '6px 14px', borderRadius: '999px', background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.14)', fontSize: '0.8rem', fontWeight: 700, color: '#6ee7b7' }}>
                {copy.pricingTeaser[0]}
              </span>
              <h2 style={{ fontSize: 'clamp(1.7rem, 3.2vw, 2.5rem)', fontWeight: 800, letterSpacing: '-0.025em', margin: '18px 0 14px' }}>
                {copy.pricingTeaser[1]}
              </h2>
              <p style={{ color: '#9aa8c2', lineHeight: 1.8, margin: '0 0 30px' }}>{copy.pricingTeaser[2]}</p>
              <div style={{ display: 'flex', gap: '13px', flexWrap: 'wrap' }}>
                <Link href="/pricing" className="btn-hero btn-hero-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '9px' }}>
                  {copy.pricingTeaser[3]} <ArrowRight size={18} />
                </Link>
                <a href="/api/auth/entry" className="btn-hero btn-hero-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: '9px' }}>
                  {copy.hero[3]}
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <FAQ />
      <Footer />
    </main>
  );
}
