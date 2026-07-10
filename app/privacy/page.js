'use client';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function PrivacyPolicy() {
  const router = useRouter();
  
  return (
    <main style={{ minHeight: '100vh', padding: '60px 24px', background: 'var(--background)' }}>
      <div className="container" style={{ maxWidth: '800px', background: 'white', padding: '48px', borderRadius: '24px', boxShadow: 'var(--shadow-md)' }}>
        <button onClick={() => router.back()} className="btn btn-outline" style={{ marginBottom: '32px', padding: '8px 16px', borderRadius: '12px' }}>
          <ArrowLeft size={16} /> 返回
        </button>
        
        <h1 style={{ fontSize: '2.5rem', marginBottom: '24px' }}>隐私政策</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>最后更新时间：2026年7月</p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', lineHeight: 1.8, color: 'var(--text-main)' }}>
          <section>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '16px' }}>1. 信息收集</h2>
            <p>我们仅收集为您提供服务所必需的最少信息，包括但不限于您的注册邮箱以及您主动上传用于处理的文档。所有的文档在通过底层沙盒引擎处理完成后，均不会被用于任何商业用途或模型训练。</p>
          </section>
          
          <section>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '16px' }}>2. 数据安全</h2>
            <p>我们采用业界标准的高级加密技术来保护您的数据安全。您的文件在传输过程中受到 TLS 加密保护，在存储状态下（如您选择持久化保存）使用 AES-256 加密。执行脚本的环境位于完全隔离的沙箱内。</p>
          </section>
          
          <section>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '16px' }}>3. 信息共享</h2>
            <p>我们郑重承诺，绝不出售、出租或以任何形式向第三方泄露您的个人信息和文档内容。除遵守相关法律法规或响应合法强制性要求外，您的数据仅对您个人可见。</p>
          </section>
          
          <section>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '16px' }}>4. 您的权利</h2>
            <p>您随时有权访问、修改或要求删除您的个人数据和历史记录。如果您希望注销账户并清除所有足迹，可以通过联系支持邮箱提出请求，我们会在验证后立即执行。</p>
          </section>
        </div>
      </div>
    </main>
  );
}
