'use client';
import { ArrowLeft, Building2, Target, Users, Mail } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AboutUs() {
  const router = useRouter();
  
  return (
    <main style={{ minHeight: '100vh', padding: '60px 24px', background: 'var(--background)' }}>
      <div className="container" style={{ maxWidth: '800px', background: 'white', padding: '48px', borderRadius: '24px', boxShadow: 'var(--shadow-md)' }}>
        <button onClick={() => router.back()} className="btn btn-outline" style={{ marginBottom: '32px', padding: '8px 16px', borderRadius: '12px' }}>
          <ArrowLeft size={16} /> 返回
        </button>
        
        <h1 style={{ fontSize: '2.5rem', marginBottom: '8px' }}>关于我们</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '40px', fontSize: '1.1rem' }}>深圳市星尚硕教育科技有限公司</p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', lineHeight: 1.8, color: 'var(--text-main)' }}>
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ padding: '8px', background: 'var(--primary-light)', borderRadius: '12px', color: 'var(--primary)' }}><Building2 size={24} /></div>
              <h2 style={{ fontSize: '1.5rem', margin: 0 }}>公司简介</h2>
            </div>
            <p>
              深圳市星尚硕教育科技有限公司是一家致力于将前沿人工智能技术与数字化生产力工具相融合的创新型科技企业。我们依托在教育科技与数据挖掘领域的深厚技术积淀，向企业数字化、办公自动化领域不断迈进。我们相信，技术的最终目的是为了解放人的创造力，让每一位知识工作者都能从繁杂的数据处理中脱身。
            </p>
          </section>
          
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ padding: '8px', background: 'var(--primary-light)', borderRadius: '12px', color: 'var(--primary)' }}><Target size={24} /></div>
              <h2 style={{ fontSize: '1.5rem', margin: 0 }}>我们的使命与愿景</h2>
            </div>
            <p>
              <strong>使命：</strong>用 AI 赋能生产力，打破传统软件的操作壁垒。<br />
              <strong>愿景：</strong>让每一个职场人和教育工作者，无论是否具备编程或数据分析背景，都能通过自然语言与智能系统直接对话，极速解决极其复杂的表格计算与排版难题，成为新时代的“数据大师”。
            </p>
          </section>
          
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ padding: '8px', background: 'var(--primary-light)', borderRadius: '12px', color: 'var(--primary)' }}><Users size={24} /></div>
              <h2 style={{ fontSize: '1.5rem', margin: 0 }}>技术实力与核心团队</h2>
            </div>
            <p>
              公司汇聚了业内优秀的人工智能算法专家与底层系统架构师。凭借自主研发的核心驱动引擎，我们成功实现了大语言模型与底层文档沙盒的完美协同，能够在保障数据绝对安全隐私的前提下，实现复杂的宏命令与图表生成逻辑的“秒级实时渲染”。
            </p>
          </section>
          
          <div style={{ marginTop: '20px', padding: '24px', background: 'var(--background)', borderRadius: '16px', border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Mail size={20} color="var(--primary)" /> 商务合作与联系支持
            </h3>
            <p style={{ margin: 0 }}>
              如果您对我们的产品有任何建议、商务需求或是合作意向，欢迎随时通过邮件与我们取得联系。
            </p>
            <a href="mailto:sino_miles@foxmail.com" style={{ display: 'inline-block', marginTop: '16px', color: 'var(--primary)', fontWeight: '600', textDecoration: 'none' }}>
              ✉️ sino_miles@foxmail.com
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
