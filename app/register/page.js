'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '../i18n/I18nProvider';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { t } = useI18n();

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (password !== confirmPassword) {
      setError(t('auth.passwordMismatch'));
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      
      if (data.success) {
        const nextPath = new URLSearchParams(window.location.search).get('next');
        router.push(nextPath?.startsWith('/') && !nextPath.startsWith('//') ? nextPath : '/dashboard');
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError(t('auth.networkError'));
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
          <p style={{ color: 'var(--text-muted)' }}>{t('auth.registerIntro')}</p>
        </div>

        {error && <div style={{ padding: '12px', background: '#fee2e2', color: '#ef4444', borderRadius: 'var(--radius-sm)', marginBottom: '16px', fontSize: '0.9rem' }}>{error}</div>}

        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 500 }}>{t('auth.email')}</label>
            <input 
              type="email" 
              className="input-base" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              required 
              placeholder="name@company.com"
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 500 }}>{t('auth.password')}</label>
            <input 
              type="password" 
              className="input-base" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required 
              placeholder={t('auth.passwordPlaceholder')}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 500 }}>{t('auth.confirmPassword')}</label>
            <input 
              type="password" 
              className="input-base" 
              value={confirmPassword} 
              onChange={e => setConfirmPassword(e.target.value)} 
              required 
              placeholder={t('auth.confirmPlaceholder')}
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px', marginTop: '8px' }} disabled={loading}>
            {loading ? t('auth.registering') : t('auth.register')}
          </button>
        </form>
        
        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '0.9rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>{t('auth.hasAccount')}</span>{' '}
          <a href="/login" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 500 }}>{t('auth.goLogin')}</a>
        </div>
      </div>
    </div>
  );
}
