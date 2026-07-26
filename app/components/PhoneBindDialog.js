'use client';

import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, X } from 'lucide-react';

const SEND_COOLDOWN_SECONDS = 60;

// 绑定手机号弹窗。图形验证码 + 短信验证码两道，和注册页同一套人机校验，
// 只是这里的目的是把「注册赠送额度」挪到一个有真实成本的身份上。
export default function PhoneBindDialog({ open, onClose, onBound, bonusCredits = 10000, dismissible = true }) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [captcha, setCaptcha] = useState(null);
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // 两个 setState 都放在 await 之后：打开弹窗的 effect 会同步调到这里，
  // 而 React 19 不允许在 effect 体内同步触发状态更新。
  const refreshCaptcha = useCallback(async () => {
    const response = await fetch('/api/auth/captcha', { cache: 'no-store' });
    if (!response.ok) return;
    const next = await response.json();
    setCaptcha(next);
    setCaptchaAnswer('');
  }, []);

  // 首张图形验证码在 .then 里落状态，而不是同步调 refreshCaptcha ——
  // effect 体内同步触发更新会引发级联渲染，与注册页用的是同一种写法。
  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    void fetch('/api/auth/captcha', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((next) => {
        if (cancelled || !next) return;
        setCaptcha(next);
        setCaptchaAnswer('');
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [open]);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  if (!open) return null;

  const sendCode = async () => {
    setError('');
    if (!/^1[3-9]\d{9}$/.test(phone.replace(/[\s-]/g, ''))) return setError('请输入有效的中国大陆手机号');
    if (!captchaAnswer || !captcha?.id) return setError('请先填写图形验证码');
    setSending(true);
    try {
      const response = await fetch('/api/auth/phone/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, captchaId: captcha.id, captchaAnswer }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || '验证码发送失败');
      setCooldown(SEND_COOLDOWN_SECONDS);
    } catch (sendError) {
      setError(sendError.message);
      // 图形验证码是一次性的，失败后必须换一张，否则用户会卡在「一直错」。
      void refreshCaptcha();
    } finally {
      setSending(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const response = await fetch('/api/auth/phone/bind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || '绑定失败');
      onBound?.(payload);
    } catch (bindError) {
      setError(bindError.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div
        onClick={dismissible ? onClose : undefined}
        style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(3px)' }}
      />
      <div role="dialog" aria-modal="true" aria-label="绑定手机号" style={{ position: 'relative', zIndex: 1, width: '420px', maxWidth: '100%', background: '#fff', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', padding: '26px', animation: 'scaleIn 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
        {dismissible && (
          <button type="button" onClick={onClose} aria-label="关闭" style={{ position: 'absolute', top: '14px', right: '14px', width: '30px', height: '30px', display: 'grid', placeItems: 'center', border: 'none', borderRadius: '8px', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={17} /></button>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <span style={{ width: '34px', height: '34px', display: 'grid', placeItems: 'center', borderRadius: '10px', background: 'var(--primary-light)', color: 'var(--primary)' }}><ShieldCheck size={18} /></span>
          <h3 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 700 }}>绑定手机号</h3>
        </div>
        <p style={{ margin: '0 0 18px', color: 'var(--text-muted)', fontSize: '0.86rem', lineHeight: 1.7 }}>
          绑定后即可发起 AI 任务，并立即到账 <b style={{ color: 'var(--primary)' }}>{bonusCredits.toLocaleString('zh-CN')} Credits</b> 新人额度。一个手机号只能绑定一个账号。
        </p>

        <form onSubmit={submit} style={{ display: 'grid', gap: '13px' }}>
          <label style={{ display: 'grid', gap: '6px', fontSize: '0.84rem' }}>
            手机号
            <input className="input-base" value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="numeric" autoComplete="tel" placeholder="11 位手机号" required />
          </label>

          <label style={{ display: 'grid', gap: '6px', fontSize: '0.84rem' }}>
            图形验证码
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 132px', gap: '9px' }}>
              <input className="input-base" value={captchaAnswer} onChange={(event) => setCaptchaAnswer(event.target.value)} placeholder="输入图中字符" autoComplete="off" required />
              <button type="button" onClick={() => void refreshCaptcha()} style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border)', borderRadius: '10px', background: '#f8fafc', cursor: 'pointer' }}>
                {captcha?.image ? <Image src={captcha.image} alt="图形验证码，点击刷新" width={132} height={42} unoptimized style={{ width: '100%', height: '42px', objectFit: 'cover', display: 'block' }} /> : '加载中'}
              </button>
            </div>
          </label>

          <label style={{ display: 'grid', gap: '6px', fontSize: '0.84rem' }}>
            短信验证码
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '9px' }}>
              <input className="input-base" value={code} onChange={(event) => setCode(event.target.value)} inputMode="numeric" maxLength={6} placeholder="6 位数字" autoComplete="one-time-code" required />
              <button type="button" className="btn btn-outline" onClick={() => void sendCode()} disabled={sending || cooldown > 0} style={{ whiteSpace: 'nowrap' }}>
                {cooldown > 0 ? `${cooldown}s 后重发` : sending ? '发送中…' : '发送验证码'}
              </button>
            </div>
          </label>

          {error && <p style={{ margin: 0, color: '#dc2626', fontSize: '0.83rem' }}>{error}</p>}

          <button type="submit" className="btn btn-primary" disabled={submitting} style={{ marginTop: '3px' }}>
            {submitting ? '绑定中…' : '完成绑定'}
          </button>
        </form>
      </div>
    </div>
  );
}
