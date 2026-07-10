'use client';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function TermsOfService() {
  const router = useRouter();
  
  return (
    <main style={{ minHeight: '100vh', padding: '60px 24px', background: 'var(--background)' }}>
      <div className="container" style={{ maxWidth: '800px', background: 'white', padding: '48px', borderRadius: '24px', boxShadow: 'var(--shadow-md)' }}>
        <button onClick={() => router.back()} className="btn btn-outline" style={{ marginBottom: '32px', padding: '8px 16px', borderRadius: '12px' }}>
          <ArrowLeft size={16} /> 返回
        </button>
        
        <h1 style={{ fontSize: '2.5rem', marginBottom: '24px' }}>服务条款</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>最后更新时间：2026年7月</p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', lineHeight: 1.8, color: 'var(--text-main)' }}>
          <section>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '16px' }}>1. 接受条款</h2>
            <p>欢迎使用 OfficeGPT（以下简称“本服务”）。通过访问或使用本服务，即表示您已阅读、理解并同意接受本服务条款的所有内容。如果您不同意这些条款的任何部分，请立即停止使用本服务。</p>
          </section>
          
          <section>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '16px' }}>2. 服务描述</h2>
            <p>本服务提供基于人工智能的文档处理与自动化工具。服务按“现状”和“现有”基础提供，我们保留在不事先通知的情况下修改、暂停或终止任何服务功能的权利。</p>
          </section>
          
          <section>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '16px' }}>3. 用户行为准则</h2>
            <p>您承诺不在使用本服务时进行任何违法、侵权或破坏性的行为。您不得利用本服务处理包含违法内容、淫秽色情或侵犯他人知识产权的文档。我们保留随时封禁违规账户的权利，而无需退还任何费用。</p>
          </section>
          
          <section>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '16px' }}>4. 费用与退款</h2>
            <p>我们采用按量计费 (Token-based) 的收费模式。所有充值款项均为最终消费，除非法律强制要求，否则我们不提供退款服务。请您在充值前谨慎评估自己的使用需求。</p>
          </section>
        </div>
      </div>
    </main>
  );
}
