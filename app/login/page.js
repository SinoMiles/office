'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      
      if (data.success) {
        const urlParams = new URLSearchParams(window.location.search);
        let nextPath = urlParams.get('next') || '/dashboard';
        
        // 权限校验拦截：如果是普通用户试图跳转到后台，强行重定向到工作台，防止死循环
        if (nextPath.startsWith('/admin') && data.user.role !== 'admin') {
          nextPath = '/dashboard';
        }

        router.push(nextPath);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--background)' }}>
      <div className="glass-card" style={{ padding: '48px', width: '100%', maxWidth: '400px', background: 'white' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ color: 'var(--primary)' }}>✦</span> OfficeGPT
          </div>
          <p style={{ color: 'var(--text-muted)' }}>欢迎回来，请登录您的账户</p>
        </div>

        {error && <div style={{ padding: '12px', background: '#fee2e2', color: '#ef4444', borderRadius: 'var(--radius-sm)', marginBottom: '16px', fontSize: '0.9rem' }}>{error}</div>}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 500 }}>邮箱</label>
            <input 
              type="email" 
              className="input-base" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              required 
              placeholder="admin@example.com"
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 500 }}>密码</label>
            <input 
              type="password" 
              className="input-base" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required 
              placeholder="••••••••"
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px', marginTop: '8px' }} disabled={loading}>
            {loading ? '登录中...' : '登 录'}
          </button>
        </form>

        <div style={{ marginTop: '24px', textAlign: 'center', position: 'relative' }}>
          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '16px 0' }} />
          <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'white', padding: '0 8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            第三方快捷登录
          </span>
        </div>

        <button 
          onClick={() => window.location.href = '/api/auth/wechat'} 
          className="btn btn-outline" 
          style={{ width: '100%', padding: '12px', marginTop: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#05c160', borderColor: '#05c160' }}
        >
          <svg viewBox="0 0 1024 1024" width="20" height="20"><path d="M685.257 588.225c-85.39 0-154.596-59.508-154.596-132.884 0-73.351 69.206-132.908 154.596-132.908 85.39 0 154.57 59.557 154.57 132.908 0 73.376-69.18 132.884-154.57 132.884z m-356.124-78.361c-112.593 0-203.951-78.434-203.951-175.253 0-96.843 91.358-175.325 203.951-175.325 112.592 0 203.974 78.482 203.974 175.325 0 96.82-91.382 175.253-203.974 175.253z m654.516 46.852c0-101.465-103.541-183.743-231.258-183.743-16.14 0-31.914 1.348-47.16 3.916-25.045-81.821-114.73-141.446-218.423-141.446-126.963 0-229.897 86.811-229.897 193.945 0 58.73 31.026 111.391 79.52 146.471l-24.996 74.457 88.087-43.518c27.172 7.747 56.402 12.016 87.288 12.016 11.233 0 22.251-0.674 33.003-1.898 33.193 57.378 100.899 96.657 178.682 96.657 23.36 0 45.69-3.328 66.425-9.356l68.791 34.02-19.535-58.156c38.019-27.424 62.483-66.241 62.483-109.912z" fill="#05c160"/></svg>
          微信扫码登录
        </button>

        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '0.9rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>还没有账号？</span>{' '}
          <a href="/register" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 500 }}>免费注册获赠 10,000 Tokens</a>
        </div>
      </div>
    </div>
  );
}
