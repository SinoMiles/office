'use client';

import { ArrowRight, Zap, Shield, Sparkles, BarChart3, Clock, CheckCircle2, MessageSquare, LineChart, FileText, Bot, Database, Workflow } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Footer from './components/Footer';
import FAQ from './components/FAQ';
import { useI18n } from './i18n/I18nProvider';
import { homeCopy } from './i18n/homeCopy';

export default function LandingPage() {
  const router = useRouter();
  const { locale } = useI18n();
  const copy = homeCopy[locale] || homeCopy['zh-CN'];

  return (
    <main style={{ overflowX: 'hidden' }}>
      {/* Hero Section */}
      <section style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        flexDirection: 'column', 
        justifyContent: 'center', 
        padding: '120px 24px 60px 24px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Dynamic Cool Morphing Blobs Background & Animated Grid */}
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 0 }}>
          {/* Animated Blob 1 (Blue/Purple) */}
          <div className="blob" style={{ top: '-10%', left: '-10%', width: '600px', height: '600px', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}></div>
          {/* Animated Blob 2 (Green/Cyan) */}
          <div className="blob" style={{ bottom: '-20%', right: '-10%', width: '700px', height: '700px', background: 'linear-gradient(135deg, #10b981, #0ea5e9)', animationDelay: '-4s' }}></div>
          {/* Animated Blob 3 (Rose/Orange) */}
          <div className="blob" style={{ top: '30%', left: '40%', width: '500px', height: '500px', background: 'linear-gradient(135deg, #f43f5e, #f59e0b)', animationDelay: '-8s', animationDuration: '25s' }}></div>
          
          {/* Frosted Glass Overlay to blend the colors FIRST */}
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(248, 250, 252, 0.7)', backdropFilter: 'blur(80px)', WebkitBackdropFilter: 'blur(80px)' }}></div>

          {/* Animated Tech Grid (Rendered ON TOP of the blur so it stays crisp) */}
          <div style={{ 
            position: 'absolute', 
            inset: '-50%', 
            backgroundImage: 'linear-gradient(rgba(16, 185, 129, 0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(16, 185, 129, 0.15) 1px, transparent 1px)', 
            backgroundSize: '50px 50px',
            animation: 'slideGrid 3s linear infinite',
            maskImage: 'linear-gradient(to bottom, transparent, black 40%, black 60%, transparent)',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 40%, black 60%, transparent)',
            transform: 'perspective(1000px) rotateX(60deg)'
          }}></div>
        </div>

        {/* 2-Column Split Layout */}
        <div className="container" style={{ zIndex: 1, position: 'relative', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px', alignItems: 'center' }}>
          
          {/* Left Column: Content */}
          <div style={{ textAlign: 'left' }}>
            
            <h1 style={{ fontSize: 'clamp(3rem, 5vw, 5rem)', fontWeight: 800, lineHeight: 1.1, marginBottom: '24px', letterSpacing: '-0.04em', animation: 'slideUp 0.6s ease-out' }}>
              {copy.hero[0]} <br />
              <span style={{ position: 'relative', display: 'inline-block' }}>
                <span className="text-gradient">{copy.hero[1]}</span>
                {/* Sparkle decorative element */}
                <div style={{ position: 'absolute', top: '-10px', right: '-30px', color: '#fbbf24', animation: 'pulse 2s infinite' }}><Sparkles size={32} /></div>
              </span>
            </h1>
            
            <p style={{ fontSize: '1.25rem', color: 'var(--text-muted)', marginBottom: '48px', maxWidth: '600px', lineHeight: 1.6, animation: 'slideUp 0.7s ease-out', fontWeight: 400 }}>
              {copy.hero[2]}
            </p>
            
            <div style={{ display: 'flex', gap: '20px', animation: 'slideUp 0.8s ease-out' }}>
              <a
                href="/api/auth/entry"
                className="btn btn-primary" 
                style={{ padding: '18px 40px', fontSize: '1.1rem', borderRadius: 'var(--radius-full)', boxShadow: '0 8px 30px rgba(16, 185, 129, 0.3)', textDecoration: 'none' }}
              >
                {copy.hero[3]} <ArrowRight size={20} />
              </a>
            </div>
          </div>

          {/* Right Column: 3D Floating Demo */}
          <div style={{ position: 'relative', animation: 'slideUp 1s ease-out' }}>
            <div style={{ 
              animation: 'float3d 12s ease-in-out infinite', 
              transformStyle: 'preserve-3d'
            }}>
              {/* Demo Window Chrome (Browser-like top bar) */}
              <div style={{ 
                background: 'rgba(255,255,255,0.9)', 
                backdropFilter: 'blur(20px)',
                borderTopLeftRadius: '24px', 
                borderTopRightRadius: '24px', 
                padding: '16px 24px', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                border: '1px solid rgba(255,255,255,0.5)',
                borderBottom: 'none',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
              }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ef4444' }}></div>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#f59e0b' }}></div>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#10b981' }}></div>
                <div style={{ marginLeft: '16px', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500, opacity: 0.6 }}>officegpt.app/workspace</div>
              </div>
              
              {/* Demo Image */}
              <img 
                src="/hero-demo.jpg" 
                alt="OfficeGPT Dashboard Demo" 
                style={{ 
                  width: '100%', 
                  borderBottomLeftRadius: '24px', 
                  borderBottomRightRadius: '24px', 
                  boxShadow: '0 30px 60px -12px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255,255,255,0.4)', 
                  display: 'block', 
                  objectFit: 'cover' 
                }} 
              />
              
              {/* Subliminal glowing reflection under the image */}
              <div style={{ position: 'absolute', bottom: '-40px', left: '10%', right: '10%', height: '20px', background: 'var(--primary)', filter: 'blur(30px)', opacity: 0.4, borderRadius: '50%', zIndex: -1 }}></div>
            </div>
          </div>
          
        </div>
      </section>

      {/* How it Works Section - Flow Design */}
      <section id="features" style={{ padding: '120px 24px', background: 'white', position: 'relative', overflow: 'hidden' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '80px', position: 'relative', zIndex: 2 }}>
            <div style={{ display: 'inline-block', color: 'var(--primary)', fontWeight: 700, marginBottom: '16px', padding: '8px 16px', background: 'var(--primary-light)', borderRadius: '20px', fontSize: '0.9rem' }}>{copy.workflow[0]}</div>
            <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', marginBottom: '24px', fontWeight: 800, letterSpacing: '-0.02em' }}>{copy.workflow[1]}</h2>
            <p style={{ fontSize: '1.2rem', color: 'var(--text-muted)', maxWidth: '600px', margin: '0 auto' }}>{copy.workflow[2]}</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px', position: 'relative', maxWidth: '1100px', margin: '0 auto', zIndex: 2 }}>
            
            {/* Step 1 */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', background: 'rgba(255,255,255,0.6)', padding: '40px 32px', borderRadius: '24px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', transition: 'all 0.3s ease', cursor: 'default' }} onMouseOver={e=>e.currentTarget.style.transform='translateY(-5px)'} onMouseOut={e=>e.currentTarget.style.transform='none'}>
              <div style={{ width: '72px', height: '72px', background: 'linear-gradient(135deg, var(--primary) 0%, #10b981 100%)', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', boxShadow: '0 10px 25px -5px rgba(16,185,129,0.4)', marginBottom: '24px', transform: 'rotate(-5deg)' }}>
                <Database size={32} />
              </div>
              <h3 style={{ fontSize: '1.35rem', marginBottom: '16px', fontWeight: 700 }}>{copy.steps[0][0]}</h3>
              <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, fontSize: '1rem' }}>{copy.steps[0][1]}</p>
            </div>

            {/* Step 2 */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', background: 'rgba(255,255,255,0.6)', padding: '40px 32px', borderRadius: '24px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', transition: 'all 0.3s ease', cursor: 'default' }} onMouseOver={e=>e.currentTarget.style.transform='translateY(-5px)'} onMouseOut={e=>e.currentTarget.style.transform='none'}>
              <div style={{ width: '72px', height: '72px', background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', boxShadow: '0 10px 25px -5px rgba(59,130,246,0.4)', marginBottom: '24px', transform: 'rotate(5deg)' }}>
                <Bot size={32} />
              </div>
              <h3 style={{ fontSize: '1.35rem', marginBottom: '16px', fontWeight: 700 }}>{copy.steps[1][0]}</h3>
              <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, fontSize: '1rem' }}>{copy.steps[1][1]}</p>
            </div>

            {/* Step 3 */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', background: 'rgba(255,255,255,0.6)', padding: '40px 32px', borderRadius: '24px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', transition: 'all 0.3s ease', cursor: 'default' }} onMouseOver={e=>e.currentTarget.style.transform='translateY(-5px)'} onMouseOut={e=>e.currentTarget.style.transform='none'}>
              <div style={{ width: '72px', height: '72px', background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', boxShadow: '0 10px 25px -5px rgba(139,92,246,0.4)', marginBottom: '24px', transform: 'rotate(-5deg)' }}>
                <Workflow size={32} />
              </div>
              <h3 style={{ fontSize: '1.35rem', marginBottom: '16px', fontWeight: 700 }}>{copy.steps[2][0]}</h3>
              <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, fontSize: '1rem' }}>{copy.steps[2][1]}</p>
            </div>
          </div>
        </div>
      </section>



      {/* Pricing Section */}
      <section id="pricing" style={{ padding: '120px 24px', background: 'white' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '80px' }}>
            <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', marginBottom: '24px', fontWeight: 800, letterSpacing: '-0.02em' }}>{copy.pricing[0]}</h2>
            <p style={{ fontSize: '1.2rem', color: 'var(--text-muted)', maxWidth: '600px', margin: '0 auto' }}>{copy.pricing[1]}</p>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '40px', maxWidth: '1000px', margin: '0 auto' }}>
            
            {/* Free Tier */}
            <div className="pricing-card" style={{ padding: '56px 40px', border: '1px solid var(--border)', borderRadius: '32px' }}>
              <h3 style={{ fontSize: '1.5rem', marginBottom: '8px', fontWeight: 700 }}>{copy.pricing[2]}</h3>
              <div style={{ fontSize: '3.5rem', fontWeight: 800, marginBottom: '24px', letterSpacing: '-0.04em' }}>¥ 0</div>
              <p style={{ color: 'var(--text-muted)', marginBottom: '40px', fontSize: '1.1rem' }}>{copy.pricing[3]}</p>
              
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 48px 0', display: 'flex', flexDirection: 'column', gap: '20px', fontSize: '1.05rem' }}>
                {copy.free.map((item, index) => <li key={item} style={{ display: 'flex', gap: '16px', alignItems: 'center', color: index === 3 ? 'var(--text-muted)' : undefined }}>{index === 3 ? <Shield size={24} /> : <CheckCircle2 size={24} color="var(--primary)" />} <span>{item}</span></li>)}
              </ul>
              
              <a href="/api/auth/entry" className="btn btn-outline" style={{ width: '100%', padding: '16px', fontSize: '1.1rem', borderRadius: '16px', textDecoration: 'none' }}>{copy.pricing[4]}</a>
            </div>

            {/* Pro Tier (Animated Border) */}
            <div className="animated-border">
              <div style={{ position: 'absolute', top: '-16px', left: '50%', transform: 'translateX(-50%)', background: 'var(--primary)', color: 'white', padding: '6px 20px', borderRadius: 'var(--radius-full)', fontSize: '0.9rem', fontWeight: 'bold', zIndex: 10, boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)' }}>{copy.pricing[5]}</div>
              
              <div style={{ background: 'white', padding: '56px 40px', borderRadius: '24px', height: '100%' }}>
                <h3 style={{ fontSize: '1.5rem', marginBottom: '8px', fontWeight: 700 }}>{copy.pricing[6]}</h3>
                <div style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '24px', letterSpacing: '-0.02em', color: 'var(--primary)', marginTop: '20px' }}>{copy.pricing[7]}</div>
                <p style={{ color: 'var(--text-muted)', marginBottom: '40px', fontSize: '1.1rem' }}>{copy.pricing[8]}</p>
                
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 48px 0', display: 'flex', flexDirection: 'column', gap: '20px', fontSize: '1.05rem' }}>
                  {copy.pro.map((item) => <li key={item} style={{ display: 'flex', gap: '16px', alignItems: 'center' }}><CheckCircle2 size={24} color="var(--primary)" /> <span>{item}</span></li>)}
                </ul>
                
                <button className="btn btn-primary" style={{ width: '100%', padding: '16px', fontSize: '1.1rem', borderRadius: '16px', boxShadow: '0 8px 24px rgba(16,185,129,0.3)' }} onClick={() => router.push('/login')}>{copy.pricing[9]}</button>
              </div>
            </div>
            
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <FAQ />

      <Footer />
    </main>
  );
}
