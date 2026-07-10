'use client';

import { ArrowRight, Zap, Shield, Sparkles, BarChart3, Clock, CheckCircle2, MessageSquare, LineChart, FileText, Bot, Database, Workflow } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function LandingPage() {
  const router = useRouter();

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
        {/* Dynamic Cool Morphing Blobs Background */}
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 0 }}>
          {/* Animated Blob 1 (Blue/Purple) */}
          <div className="blob" style={{ top: '-10%', left: '-10%', width: '600px', height: '600px', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}></div>
          {/* Animated Blob 2 (Green/Cyan) */}
          <div className="blob" style={{ bottom: '-20%', right: '-10%', width: '700px', height: '700px', background: 'linear-gradient(135deg, #10b981, #0ea5e9)', animationDelay: '-4s' }}></div>
          {/* Animated Blob 3 (Rose/Orange) */}
          <div className="blob" style={{ top: '30%', left: '40%', width: '500px', height: '500px', background: 'linear-gradient(135deg, #f43f5e, #f59e0b)', animationDelay: '-8s', animationDuration: '25s' }}></div>
          
          {/* Frosted Glass Overlay to keep content readable and blend the colors */}
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(248, 250, 252, 0.7)', backdropFilter: 'blur(100px)', WebkitBackdropFilter: 'blur(100px)' }}></div>
        </div>

        {/* 2-Column Split Layout */}
        <div className="container" style={{ zIndex: 1, position: 'relative', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px', alignItems: 'center' }}>
          
          {/* Left Column: Content */}
          <div style={{ textAlign: 'left' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 20px', background: 'rgba(255, 255, 255, 0.7)', border: '1px solid rgba(255,255,255,0.8)', color: 'var(--text-main)', borderRadius: 'var(--radius-full)', fontWeight: 600, fontSize: '0.9rem', marginBottom: '32px', animation: 'slideUp 0.5s ease-out', backdropFilter: 'blur(10px)', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', background: 'var(--primary)', color: 'white', borderRadius: '50%' }}><Sparkles size={14} /></span>
              搭载次世代 Deepseek 大模型推理引擎
            </div>
            
            <h1 style={{ fontSize: 'clamp(3rem, 5vw, 5rem)', fontWeight: 800, lineHeight: 1.1, marginBottom: '24px', letterSpacing: '-0.04em', animation: 'slideUp 0.6s ease-out' }}>
              与你的数据 <br />
              <span style={{ position: 'relative', display: 'inline-block' }}>
                <span className="text-gradient">直接对话</span>
                {/* Sparkle decorative element */}
                <div style={{ position: 'absolute', top: '-10px', right: '-30px', color: '#fbbf24', animation: 'pulse 2s infinite' }}><Sparkles size={32} /></div>
              </span>
            </h1>
            
            <p style={{ fontSize: '1.25rem', color: 'var(--text-muted)', marginBottom: '48px', maxWidth: '600px', lineHeight: 1.6, animation: 'slideUp 0.7s ease-out', fontWeight: 400 }}>
              OfficeGPT 彻底颠覆传统办公软件的交互方式。无需记忆任何函数公式，告别繁琐的下拉菜单。只需输入自然语言，AI 将在数秒内为你完成一切复杂运算与排版。
            </p>
            
            <div style={{ display: 'flex', gap: '20px', animation: 'slideUp 0.8s ease-out' }}>
              <a
                href="/api/auth/entry"
                className="btn btn-primary" 
                style={{ padding: '18px 40px', fontSize: '1.1rem', borderRadius: 'var(--radius-full)', boxShadow: '0 8px 30px rgba(16, 185, 129, 0.3)', textDecoration: 'none' }}
              >
                免费体验 <ArrowRight size={20} />
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
      <section id="solutions" style={{ padding: '120px 24px', background: 'white', position: 'relative', overflow: 'hidden' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '80px', position: 'relative', zIndex: 2 }}>
            <div style={{ display: 'inline-block', color: 'var(--primary)', fontWeight: 700, marginBottom: '16px', padding: '8px 16px', background: 'var(--primary-light)', borderRadius: '20px', fontSize: '0.9rem' }}>工作流革命</div>
            <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', marginBottom: '24px', fontWeight: 800, letterSpacing: '-0.02em' }}>像聊天一样，搞定繁琐数据</h2>
            <p style={{ fontSize: '1.2rem', color: 'var(--text-muted)', maxWidth: '600px', margin: '0 auto' }}>打破软件操作壁垒，将您的意图直接转化为精准的计算结果。</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', position: 'relative', maxWidth: '1000px', margin: '0 auto', zIndex: 2 }}>
            {/* Connection Line */}
            <div style={{ position: 'absolute', top: '50px', bottom: '50px', left: '40px', width: '2px', background: 'linear-gradient(to bottom, var(--primary), #3b82f6)', opacity: 0.3, zIndex: -1, display: 'none' }} className="flow-line"></div>
            
            {/* Step 1 */}
            <div style={{ display: 'flex', gap: '32px', alignItems: 'flex-start', background: 'rgba(255,255,255,0.6)', padding: '32px', borderRadius: '24px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', backdropFilter: 'blur(10px)' }}>
              <div style={{ width: '80px', height: '80px', flexShrink: 0, background: 'linear-gradient(135deg, var(--primary) 0%, #10b981 100%)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', boxShadow: '0 10px 25px -5px rgba(16,185,129,0.4)' }}>
                <Database size={32} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.5rem', marginBottom: '12px', fontWeight: 700 }}>1. 丢入任何杂乱数据</h3>
                <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, fontSize: '1.1rem' }}>一键上传您的 Excel、Word 或 PPT 文件。底层沙箱环境瞬间接管数据结构，确保绝对的隐私安全与极速解析。</p>
              </div>
            </div>

            {/* Step 2 */}
            <div style={{ display: 'flex', gap: '32px', alignItems: 'flex-start', background: 'rgba(255,255,255,0.6)', padding: '32px', borderRadius: '24px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', backdropFilter: 'blur(10px)' }}>
              <div style={{ width: '80px', height: '80px', flexShrink: 0, background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', boxShadow: '0 10px 25px -5px rgba(59,130,246,0.4)' }}>
                <Bot size={32} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.5rem', marginBottom: '12px', fontWeight: 700 }}>2. 输入自然语言指令</h3>
                <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, fontSize: '1.1rem' }}>告诉 AI：“把 C 列的电话号码去重，如果 D 列是空值则填充为未知，最后生成一张根据城市汇总的柱状图。”</p>
              </div>
            </div>

            {/* Step 3 */}
            <div style={{ display: 'flex', gap: '32px', alignItems: 'flex-start', background: 'rgba(255,255,255,0.6)', padding: '32px', borderRadius: '24px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', backdropFilter: 'blur(10px)' }}>
              <div style={{ width: '80px', height: '80px', flexShrink: 0, background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', boxShadow: '0 10px 25px -5px rgba(139,92,246,0.4)' }}>
                <Workflow size={32} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.5rem', marginBottom: '12px', fontWeight: 700 }}>3. 秒级实时渲染反馈</h3>
                <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, fontSize: '1.1rem' }}>基于 OfficeCLI 的底层驱动引擎，所有复杂的宏与公式被瞬间执行，修改后的成品文档将实时通过网页展现在你眼前。</p>
              </div>
            </div>
          </div>
        </div>
      </section>



      {/* Pricing Section */}
      <section id="pricing" style={{ padding: '120px 24px', background: 'white' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '80px' }}>
            <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', marginBottom: '24px', fontWeight: 800, letterSpacing: '-0.02em' }}>按量计费，童叟无欺</h2>
            <p style={{ fontSize: '1.2rem', color: 'var(--text-muted)', maxWidth: '600px', margin: '0 auto' }}>拒绝强制包月，用多少算多少，极大降低您的试错成本。</p>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '40px', maxWidth: '1000px', margin: '0 auto' }}>
            
            {/* Free Tier */}
            <div className="pricing-card" style={{ padding: '56px 40px', border: '1px solid var(--border)', borderRadius: '32px' }}>
              <h3 style={{ fontSize: '1.5rem', marginBottom: '8px', fontWeight: 700 }}>免费体验版</h3>
              <div style={{ fontSize: '3.5rem', fontWeight: 800, marginBottom: '24px', letterSpacing: '-0.04em' }}>¥ 0</div>
              <p style={{ color: 'var(--text-muted)', marginBottom: '40px', fontSize: '1.1rem' }}>适合尝鲜用户，立刻体验 AI 办公的魅力。</p>
              
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 48px 0', display: 'flex', flexDirection: 'column', gap: '20px', fontSize: '1.05rem' }}>
                <li style={{ display: 'flex', gap: '16px', alignItems: 'center' }}><CheckCircle2 size={24} color="var(--primary)" /> <span>注册即送 10,000 Tokens</span></li>
                <li style={{ display: 'flex', gap: '16px', alignItems: 'center' }}><CheckCircle2 size={24} color="var(--primary)" /> <span>基础数据分析指令支持</span></li>
                <li style={{ display: 'flex', gap: '16px', alignItems: 'center' }}><CheckCircle2 size={24} color="var(--primary)" /> <span>支持最大 10MB 的文档</span></li>
                <li style={{ display: 'flex', gap: '16px', alignItems: 'center', color: 'var(--text-muted)' }}><Shield size={24} /> <span>无专属技术支持</span></li>
              </ul>
              
              <a href="/api/auth/entry" className="btn btn-outline" style={{ width: '100%', padding: '16px', fontSize: '1.1rem', borderRadius: '16px', textDecoration: 'none' }}>免费注册</a>
            </div>

            {/* Pro Tier (Animated Border) */}
            <div className="animated-border">
              <div style={{ position: 'absolute', top: '-16px', left: '50%', transform: 'translateX(-50%)', background: 'var(--primary)', color: 'white', padding: '6px 20px', borderRadius: 'var(--radius-full)', fontSize: '0.9rem', fontWeight: 'bold', zIndex: 10, boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)' }}>最受欢迎</div>
              
              <div style={{ background: 'white', padding: '56px 40px', borderRadius: '24px', height: '100%' }}>
                <h3 style={{ fontSize: '1.5rem', marginBottom: '8px', fontWeight: 700 }}>专业版 (Pro)</h3>
                <div style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '24px', letterSpacing: '-0.02em', color: 'var(--primary)', marginTop: '20px' }}>按 Token 计费</div>
                <p style={{ color: 'var(--text-muted)', marginBottom: '40px', fontSize: '1.1rem' }}>面向专业职场人，随时充值，解锁全部高级功能。</p>
                
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 48px 0', display: 'flex', flexDirection: 'column', gap: '20px', fontSize: '1.05rem' }}>
                  <li style={{ display: 'flex', gap: '16px', alignItems: 'center' }}><CheckCircle2 size={24} color="var(--primary)" /> <span style={{ fontWeight: 600 }}>约 ¥0.02 / 1000 Tokens</span></li>
                  <li style={{ display: 'flex', gap: '16px', alignItems: 'center' }}><CheckCircle2 size={24} color="var(--primary)" /> <span>无限轮次的多文件联合对话</span></li>
                  <li style={{ display: 'flex', gap: '16px', alignItems: 'center' }}><CheckCircle2 size={24} color="var(--primary)" /> <span>解锁 Deepseek V3 推理极速版</span></li>
                  <li style={{ display: 'flex', gap: '16px', alignItems: 'center' }}><CheckCircle2 size={24} color="var(--primary)" /> <span>7x24 小时专属客户成功团队</span></li>
                </ul>
                
                <button className="btn btn-primary" style={{ width: '100%', padding: '16px', fontSize: '1.1rem', borderRadius: '16px', boxShadow: '0 8px 24px rgba(16,185,129,0.3)' }} onClick={() => router.push('/login')}>立即充值使用</button>
              </div>
            </div>
            
          </div>
        </div>
      </section>

      {/* Footer Section */}
      <footer style={{ background: '#0a0f1c', color: '#94a3b8', padding: '100px 24px 40px 24px' }}>
        <div className="container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '48px', marginBottom: '80px' }}>
          <div style={{ maxWidth: '300px' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', color: 'white', marginBottom: '24px' }}>
              <span style={{ color: 'var(--primary)' }}>✦</span>
              OfficeGPT
            </div>
            <p style={{ lineHeight: 1.6, fontSize: '0.95rem' }}>基于最新大语言模型驱动的下一代数据处理与办公自动化 SaaS 平台。</p>
          </div>
          <div>
            <h4 style={{ color: 'white', marginBottom: '24px', fontSize: '1.1rem' }}>产品</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '0.95rem' }}>
              <a href="#" style={{ textDecoration: 'none', color: 'inherit', transition: 'color 0.2s' }}>核心功能</a>
              <a href="#" style={{ textDecoration: 'none', color: 'inherit', transition: 'color 0.2s' }}>价格方案</a>
              <a href="#" style={{ textDecoration: 'none', color: 'inherit', transition: 'color 0.2s' }}>企业服务</a>
              <a href="#" style={{ textDecoration: 'none', color: 'inherit', transition: 'color 0.2s' }}>API 接口</a>
            </div>
          </div>
          <div>
            <h4 style={{ color: 'white', marginBottom: '24px', fontSize: '1.1rem' }}>资源</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '0.95rem' }}>
              <a href="#" style={{ textDecoration: 'none', color: 'inherit', transition: 'color 0.2s' }}>帮助文档</a>
              <a href="#" style={{ textDecoration: 'none', color: 'inherit', transition: 'color 0.2s' }}>最佳提示词模板</a>
              <a href="#" style={{ textDecoration: 'none', color: 'inherit', transition: 'color 0.2s' }}>开发者博客</a>
              <a href="#" style={{ textDecoration: 'none', color: 'inherit', transition: 'color 0.2s' }}>社区论坛</a>
            </div>
          </div>
          <div>
            <h4 style={{ color: 'white', marginBottom: '24px', fontSize: '1.1rem' }}>公司</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '0.95rem' }}>
              <a href="#" style={{ textDecoration: 'none', color: 'inherit', transition: 'color 0.2s' }}>关于我们</a>
              <a href="#" style={{ textDecoration: 'none', color: 'inherit', transition: 'color 0.2s' }}>联系销售</a>
              <a href="#" style={{ textDecoration: 'none', color: 'inherit', transition: 'color 0.2s' }}>隐私政策</a>
              <a href="#" style={{ textDecoration: 'none', color: 'inherit', transition: 'color 0.2s' }}>服务条款</a>
            </div>
          </div>
        </div>
        <div className="container" style={{ borderTop: '1px solid #1e293b', paddingTop: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', fontSize: '0.9rem' }}>
          <div>© 2026 OfficeGPT Inc. 保留所有权利.</div>
          <div style={{ display: 'flex', gap: '24px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--primary)', boxShadow: '0 0 10px var(--primary)' }}></div> 系统运行正常</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
