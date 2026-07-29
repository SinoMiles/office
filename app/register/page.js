'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import BrandMark from '@/app/components/BrandMark';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useI18n } from '../i18n/I18nProvider';

// useSearchParams 会让这棵子树进入 Suspense 边界，所以外面套一层。
// 用它而不是在 effect 里读 window.location：邀请码在首帧就该定下来，
// 走 effect 既多一次渲染，服务端与客户端的首帧也会对不上。
export default function RegisterPage() {
  return <Suspense fallback={null}><RegisterForm /></Suspense>;
}

function RegisterForm() {
  const inviteCode = (useSearchParams().get('invite') || '').trim().toUpperCase();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [captcha, setCaptcha] = useState(null);
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [sendingCode, setSendingCode] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { t } = useI18n();

  const refreshCaptcha = useCallback(async () => {
    const response = await fetch('/api/auth/captcha', { cache: 'no-store' });
    if (response.ok) setCaptcha(await response.json());
    setCaptchaAnswer('');
  }, []);

  useEffect(() => {
    let active = true;
    void fetch('/api/auth/captcha', { cache: 'no-store' }).then((response) => response.ok ? response.json() : null).then((value) => {
      if (active && value) setCaptcha(value);
    });
    return () => { active = false; };
  }, []);

  const sendCode = async () => {
    setError('');
    if (!email || !captchaAnswer || !captcha?.id) return setError('请先填写邮箱和图形验证码');
    setSendingCode(true);
    try {
      const response = await fetch('/api/auth/email/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, purpose: 'register', captchaId: captcha.id, captchaAnswer }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '验证码发送失败');
      setError('验证码已发送，请检查邮箱');
    } catch (sendError) {
      setError(sendError.message);
    } finally {
      setSendingCode(false);
      void refreshCaptcha();
    }
  };

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
        body: JSON.stringify({ email, password, code: emailCode, inviteCode })
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
            <BrandMark size={26} /> OfficeGPT
          </div>
          <p style={{ color: 'var(--text-muted)' }}>{t('auth.registerIntro')}</p>
          {/* 带邀请码进来的人要能看见它生效了，否则填了半天不知道算不算数 */}
          {inviteCode && (
            <p style={{ margin: '10px 0 0', padding: '7px 12px', display: 'inline-block', borderRadius: '999px', background: 'var(--primary-light)', color: 'var(--primary)', fontSize: '0.82rem', fontWeight: 600 }}>
              已使用邀请码 {inviteCode}，绑定手机号后额外获得奖励
            </p>
          )}
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
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 500 }}>图形验证码</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 132px', gap: '10px' }}>
              <input className="input-base" value={captchaAnswer} onChange={(event) => setCaptchaAnswer(event.target.value)} required placeholder="输入图中字符" autoComplete="off" />
              <button type="button" onClick={() => void refreshCaptcha()} style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border)', borderRadius: '10px', background: '#f8fafc', cursor: 'pointer' }}>{captcha?.image ? <Image src={captcha.image} alt="图形验证码，点击刷新" width={132} height={42} unoptimized style={{ width: '100%', height: '42px', objectFit: 'cover', display: 'block' }} /> : '加载中'}</button>
            </div>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 500 }}>邮箱验证码</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px' }}>
              <input className="input-base" value={emailCode} onChange={(event) => setEmailCode(event.target.value.replace(/\D/g, '').slice(0, 6))} required inputMode="numeric" placeholder="6 位验证码" autoComplete="one-time-code" />
              <button type="button" className="btn btn-outline" onClick={() => void sendCode()} disabled={sendingCode}>{sendingCode ? '发送中…' : '发送验证码'}</button>
            </div>
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
