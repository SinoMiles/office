'use client';

import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import BrandMark from '@/app/components/BrandMark';
import { useRouter } from 'next/navigation';
import { FileSpreadsheet, FileText, Presentation, ShieldCheck } from 'lucide-react';
import styles from './login.module.css';

const SEND_COOLDOWN_SECONDS = 60;

export default function LoginPage() {
  const [phone, setPhone] = useState('');
  const [mode, setMode] = useState('password');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [captcha, setCaptcha] = useState(null);
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [showAgreementPrompt, setShowAgreementPrompt] = useState(false);
  const router = useRouter();

  const refreshCaptcha = useCallback(async () => {
    const response = await fetch('/api/auth/captcha', { cache: 'no-store' });
    if (!response.ok) return;
    setCaptcha(await response.json());
    setCaptchaAnswer('');
  }, []);

  useEffect(() => {
    let active = true;
    void fetch('/api/auth/captcha', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((value) => { if (active && value) setCaptcha(value); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const sendCode = async () => {
    setError('');
    if (!/^1[3-9]\d{9}$/.test(phone.replace(/[\s-]/g, ''))) {
      setError('请输入有效的中国大陆手机号');
      return;
    }
    if (!captcha?.id || !captchaAnswer) {
      setError('请先填写图形验证码');
      return;
    }
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
      void refreshCaptcha();
    } finally {
      setSending(false);
    }
  };

  const performLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams(window.location.search);
      const response = await fetch(mode === 'password' ? '/api/auth/phone/password-login' : '/api/auth/phone/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'password'
          ? { phone, password }
          : { phone, code, inviteCode: params.get('invite') || '' }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || '登录失败，请稍后重试');
      let nextPath = params.get('next') || '/dashboard';
      if (!nextPath.startsWith('/') || nextPath.startsWith('//')) nextPath = '/dashboard';
      if (nextPath.startsWith('/admin') && payload.user?.role !== 'admin') nextPath = '/dashboard';
      router.push(nextPath);
    } catch (loginError) {
      setError(loginError.message || '网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (event) => {
    event.preventDefault();
    if (!agreementAccepted) {
      setShowAgreementPrompt(true);
      return;
    }
    void performLogin();
  };

  const acceptAgreementAndLogin = () => {
    setAgreementAccepted(true);
    setShowAgreementPrompt(false);
    void performLogin();
  };

  return (
    <main className={styles.page}>
      <div className={styles.grid} aria-hidden="true" />
      <div className={styles.glowOne} aria-hidden="true" />
      <div className={styles.glowTwo} aria-hidden="true" />
      <section className={styles.shell}>
        <aside className={styles.visual}>
          <div className={styles.visualContent}>
            <span className={styles.eyebrow}><ShieldCheck size={15} /> 安全、简单、高效</span>
            <h1>让复杂的办公任务，<br /><span>一句话完成。</span></h1>
            <p>用自然语言处理 Excel、Word、PPT 和 PDF，把更多时间留给真正重要的工作。</p>
            <div className={styles.fileStack} aria-hidden="true">
              <div className={`${styles.fileCard} ${styles.excel}`}><FileSpreadsheet size={20} /><span><b>销售数据.xlsx</b><small>分析完成 · 发现 3 项趋势</small></span></div>
              <div className={`${styles.fileCard} ${styles.ppt}`}><Presentation size={20} /><span><b>年度汇报.pptx</b><small>已生成 · 共 18 页</small></span></div>
              <div className={`${styles.fileCard} ${styles.word}`}><FileText size={20} /><span><b>项目总结.docx</b><small>排版完成 · 可以交付</small></span></div>
            </div>
          </div>
          <p className={styles.visualFoot}>OfficeGPT · AI 智能办公工作台</p>
        </aside>

        <div className={styles.card}>
        <div className={styles.formPanel}>
          <div className={styles.brand}>
            <div className={styles.logo}><BrandMark size={26} /> OfficeGPT</div>
            <p>{mode === 'password' ? '使用手机号和密码登录' : '验证码登录，未注册的手机号将自动创建账号'}</p>
          </div>

          {error && <div className={styles.error} role="alert">{error}</div>}

          <div className={styles.loginTabs} role="tablist" aria-label="登录方式">
            <button type="button" role="tab" aria-selected={mode === 'password'} className={mode === 'password' ? styles.activeTab : ''} onClick={() => { setMode('password'); setError(''); }}>密码登录</button>
            <button type="button" role="tab" aria-selected={mode === 'sms'} className={mode === 'sms' ? styles.activeTab : ''} onClick={() => { setMode('sms'); setError(''); }}>短信登录</button>
          </div>

          <form onSubmit={handleLogin} className={styles.form}>
            <label>
              <span>手机号</span>
              <input type="tel" className="input-base" value={phone} onChange={(event) => setPhone(event.target.value)} required inputMode="numeric" autoComplete="tel" placeholder="请输入 11 位手机号" />
            </label>

            {mode === 'password' ? (
              <label>
                <span>密码</span>
                <input type="password" className="input-base" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" placeholder="请输入登录密码" />
              </label>
            ) : (
              <>
                <label>
                  <span>图形验证码</span>
                  <div className={styles.captchaRow}>
                    <input className="input-base" value={captchaAnswer} onChange={(event) => setCaptchaAnswer(event.target.value.replace(/\D/g, '').slice(0, 4))} required inputMode="numeric" maxLength={4} autoComplete="off" placeholder="输入图中 4 位数字" />
                    <button type="button" className={styles.captcha} onClick={() => void refreshCaptcha()} aria-label="刷新图形验证码">
                      {captcha?.image ? <Image src={captcha.image} alt="图形验证码" width={132} height={48} unoptimized /> : '加载中'}
                    </button>
                  </div>
                </label>

                <label>
                  <span>短信验证码</span>
                  <div className={styles.codeRow}>
                    <input className="input-base" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} required inputMode="numeric" autoComplete="one-time-code" placeholder="请输入 6 位验证码" />
                    <button type="button" className={styles.sendCode} disabled={sending || cooldown > 0} onClick={() => void sendCode()}>
                      {cooldown > 0 ? `${cooldown}s 后重发` : sending ? '发送中…' : '获取验证码'}
                    </button>
                  </div>
                </label>
              </>
            )}

            <button type="submit" className={`btn btn-primary ${styles.loginButton}`} disabled={loading || (mode === 'sms' ? code.length !== 6 : password.length === 0)}>
              {loading ? '登录中…' : mode === 'password' ? '登 录' : '短信登录'}
            </button>
          </form>

          <label className={styles.agreementCheck}>
            <input type="checkbox" checked={agreementAccepted} onChange={(event) => setAgreementAccepted(event.target.checked)} />
            <span>我已阅读并同意 <a href="/terms" onClick={(event) => event.stopPropagation()}>服务条款</a> 和 <a href="/privacy" onClick={(event) => event.stopPropagation()}>隐私政策</a></span>
          </label>
          <p className={styles.agreement}>新用户通过短信登录后自动获赠 10,000 Credits。</p>
        </div>
        </div>
      </section>

      {showAgreementPrompt && (
        <div className={styles.modalLayer} role="presentation">
          <button type="button" className={styles.modalBackdrop} aria-label="关闭协议确认" onClick={() => setShowAgreementPrompt(false)} />
          <div className={styles.agreementModal} role="dialog" aria-modal="true" aria-labelledby="agreement-title">
            <span className={styles.modalIcon}><ShieldCheck size={22} /></span>
            <h2 id="agreement-title">请确认服务协议</h2>
            <p>登录 OfficeGPT 前，请阅读并同意《服务条款》和《隐私政策》。点击同意后将自动勾选，并继续本次登录。</p>
            <div className={styles.modalLinks}><a href="/terms" target="_blank">查看服务条款</a><a href="/privacy" target="_blank">查看隐私政策</a></div>
            <div className={styles.modalActions}>
              <button type="button" className={styles.cancelButton} onClick={() => setShowAgreementPrompt(false)}>暂不同意</button>
              <button type="button" className="btn btn-primary" onClick={acceptAgreementAndLogin}>同意并继续</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
