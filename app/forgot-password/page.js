'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function ForgotPasswordPage() {
  const [form, setForm] = useState({ email: '', captchaAnswer: '', code: '', password: '', confirm: '' });
  const [captcha, setCaptcha] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const refreshCaptcha = useCallback(async () => {
    const response = await fetch('/api/auth/captcha', { cache: 'no-store' });
    if (response.ok) setCaptcha(await response.json());
    setForm((current) => ({ ...current, captchaAnswer: '' }));
  }, []);
  useEffect(() => {
    let active = true;
    void fetch('/api/auth/captcha', { cache: 'no-store' }).then((response) => response.ok ? response.json() : null).then((value) => {
      if (active && value) setCaptcha(value);
    });
    return () => { active = false; };
  }, []);
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const sendCode = async () => {
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/auth/email/send-code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: form.email, purpose: 'reset-password', captchaId: captcha?.id, captchaAnswer: form.captchaAnswer }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setMessage('如果邮箱已注册，验证码已发送。');
    } catch (error) { setMessage(error.message || '发送失败'); } finally { setBusy(false); void refreshCaptcha(); }
  };
  const reset = async (event) => {
    event.preventDefault();
    if (form.password !== form.confirm) return setMessage('两次输入的密码不一致');
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/auth/password/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: form.email, code: form.code, password: form.password }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      router.push('/login');
    } catch (error) { setMessage(error.message || '重置失败'); } finally { setBusy(false); }
  };
  return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '24px', background: '#f7faf9' }}>
    <section className="glass-card" style={{ width: 'min(460px,100%)', padding: '40px', background: '#fff' }}>
      <h1 style={{ margin: 0 }}>重置密码</h1><p style={{ color: 'var(--text-muted)' }}>通过邮箱验证码设置新密码</p>
      {message ? <div style={{ padding: '11px', margin: '16px 0', borderRadius: '9px', background: '#f1f5f9' }}>{message}</div> : null}
      <form onSubmit={reset} style={{ display: 'grid', gap: '14px' }}>
        <input type="email" className="input-base" value={form.email} onChange={update('email')} required placeholder="邮箱" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 132px', gap: '10px' }}><input className="input-base" value={form.captchaAnswer} onChange={update('captchaAnswer')} required placeholder="图形验证码" /><button type="button" onClick={() => void refreshCaptcha()} style={{ padding: 0, border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>{captcha?.image ? <Image src={captcha.image} alt="验证码" width={132} height={42} unoptimized style={{ width: '100%', height: '42px', display: 'block' }} /> : '加载中'}</button></div>
        <button type="button" className="btn btn-outline" onClick={() => void sendCode()} disabled={busy}>发送邮箱验证码</button>
        <input className="input-base" value={form.code} onChange={update('code')} required placeholder="6 位邮箱验证码" inputMode="numeric" />
        <input type="password" className="input-base" value={form.password} onChange={update('password')} required minLength={8} placeholder="新密码（至少 8 位）" />
        <input type="password" className="input-base" value={form.confirm} onChange={update('confirm')} required minLength={8} placeholder="再次输入新密码" />
        <button className="btn btn-primary" disabled={busy} style={{ justifyContent: 'center' }}>重置密码</button>
      </form>
    </section>
  </main>;
}
