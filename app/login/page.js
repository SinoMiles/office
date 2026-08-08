'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import BrandMark from '@/app/components/BrandMark';
import { useRouter } from 'next/navigation';
import { FileSpreadsheet, FileText, Presentation, ShieldCheck } from 'lucide-react';
import { useI18n } from '@/app/i18n/I18nProvider';
import { loginCopy } from '@/app/i18n/loginCopy';
import { localizedPath } from '@/app/i18n/publicSeo';
import styles from './login.module.css';

const SEND_COOLDOWN_SECONDS = 60;

export default function LoginPage() {
  const { locale } = useI18n();
  const text = loginCopy(locale);
  const termsPath = localizedPath(locale, '/terms');
  const privacyPath = localizedPath(locale, '/privacy');
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
  const agreementSubmitRef = useRef(null);
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

  useEffect(() => {
    if (!showAgreementPrompt) return undefined;
    agreementSubmitRef.current?.focus();
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setShowAgreementPrompt(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [showAgreementPrompt]);

  const sendCode = async () => {
    setError('');
    if (!/^1[3-9]\d{9}$/.test(phone.replace(/[\s-]/g, ''))) {
      setError(text.invalidPhone);
      return;
    }
    if (!captcha?.id || !captchaAnswer) {
      setError(text.captchaRequired);
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
      if (!response.ok) throw new Error(payload.error || text.sendFailed);
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
      if (!response.ok) throw new Error(payload.error || text.loginFailed);
      let nextPath = params.get('next') || '/dashboard';
      if (!nextPath.startsWith('/') || nextPath.startsWith('//')) nextPath = '/dashboard';
      if (nextPath.startsWith('/admin') && payload.user?.role !== 'admin') nextPath = '/dashboard';
      router.push(nextPath);
    } catch (loginError) {
      setError(loginError.message || text.networkError);
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
            <span className={styles.eyebrow}><ShieldCheck size={15} /> {text.eyebrow}</span>
            <h1>{text.heroTitle}<br /><span>{text.heroAccent}</span></h1>
            <p>{text.heroDescription}</p>
            <div className={styles.fileStack} aria-hidden="true">
              <div className={`${styles.fileCard} ${styles.excel}`}><FileSpreadsheet size={20} /><span><b>{text.excelName}</b><small>{text.excelStatus}</small></span></div>
              <div className={`${styles.fileCard} ${styles.ppt}`}><Presentation size={20} /><span><b>{text.pptName}</b><small>{text.pptStatus}</small></span></div>
              <div className={`${styles.fileCard} ${styles.word}`}><FileText size={20} /><span><b>{text.wordName}</b><small>{text.wordStatus}</small></span></div>
            </div>
          </div>
          <p className={styles.visualFoot}>{text.visualFoot}</p>
        </aside>

        <div className={styles.card}>
        <div className={styles.formPanel}>
          <div className={styles.brand}>
            <div className={styles.logo}><BrandMark size={26} /> OfficeGPT</div>
            <p>{mode === 'password' ? text.passwordIntro : text.smsIntro}</p>
          </div>

          {error && <div className={styles.error} role="alert">{error}</div>}

          <div className={styles.loginTabs} role="tablist" aria-label={text.loginMethods}>
            <button type="button" role="tab" aria-selected={mode === 'password'} className={mode === 'password' ? styles.activeTab : ''} onClick={() => { setMode('password'); setError(''); }}>{text.passwordLogin}</button>
            <button type="button" role="tab" aria-selected={mode === 'sms'} className={mode === 'sms' ? styles.activeTab : ''} onClick={() => { setMode('sms'); setError(''); }}>{text.smsLogin}</button>
          </div>

          <form onSubmit={handleLogin} className={styles.form}>
            <label>
              <span>{text.phone}</span>
              <input type="tel" className="input-base" value={phone} onChange={(event) => setPhone(event.target.value)} required inputMode="numeric" autoComplete="tel" placeholder={text.phonePlaceholder} />
            </label>

            {mode === 'password' ? (
              <label>
                <span>{text.password}</span>
                <input type="password" className="input-base" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" placeholder={text.passwordPlaceholder} />
              </label>
            ) : (
              <>
                <label>
                  <span>{text.captcha}</span>
                  <div className={styles.captchaRow}>
                    <input className="input-base" value={captchaAnswer} onChange={(event) => setCaptchaAnswer(event.target.value.replace(/\D/g, '').slice(0, 4))} required inputMode="numeric" maxLength={4} autoComplete="off" placeholder={text.captchaPlaceholder} />
                    <button type="button" className={styles.captcha} onClick={() => void refreshCaptcha()} aria-label={text.refreshCaptcha}>
                      {captcha?.image ? <Image src={captcha.image} alt={text.captchaAlt} width={132} height={48} unoptimized /> : text.captchaLoading}
                    </button>
                  </div>
                </label>

                <label>
                  <span>{text.smsCode}</span>
                  <div className={styles.codeRow}>
                    <input className="input-base" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} required inputMode="numeric" autoComplete="one-time-code" placeholder={text.smsPlaceholder} />
                    <button type="button" className={styles.sendCode} disabled={sending || cooldown > 0} onClick={() => void sendCode()}>
                      {cooldown > 0 ? text.resendIn.replace('{seconds}', cooldown) : sending ? text.sending : text.sendCode}
                    </button>
                  </div>
                </label>
              </>
            )}

            <button type="submit" className={`btn btn-primary ${styles.loginButton}`} disabled={loading || (mode === 'sms' ? code.length !== 6 : password.length === 0)}>
              {loading ? text.loggingIn : mode === 'password' ? text.login : text.smsLogin}
            </button>
          </form>

          <label className={styles.agreementCheck}>
            <input type="checkbox" checked={agreementAccepted} onChange={(event) => setAgreementAccepted(event.target.checked)} />
            <span>{text.agreementPrefix} <a href={termsPath} onClick={(event) => event.stopPropagation()}>{text.terms}</a> {text.and} <a href={privacyPath} onClick={(event) => event.stopPropagation()}>{text.privacy}</a></span>
          </label>
          <p className={styles.agreement}>{text.bonus}</p>
        </div>
        </div>
      </section>

      {showAgreementPrompt && (
        <div className={styles.modalLayer} role="presentation">
          <button type="button" className={styles.modalBackdrop} aria-label={text.closeAgreement} onClick={() => setShowAgreementPrompt(false)} />
          <form className={styles.agreementModal} role="dialog" aria-modal="true" aria-labelledby="agreement-title" onSubmit={(event) => { event.preventDefault(); acceptAgreementAndLogin(); }}>
            <span className={styles.modalIcon}><ShieldCheck size={22} /></span>
            <h2 id="agreement-title">{text.agreementTitle}</h2>
            <p>{text.agreementDescription}</p>
            <div className={styles.modalLinks}><a href={termsPath} target="_blank">{text.viewTerms}</a><a href={privacyPath} target="_blank">{text.viewPrivacy}</a></div>
            <div className={styles.modalActions}>
              <button type="button" className={styles.cancelButton} onClick={() => setShowAgreementPrompt(false)}>{text.disagree}</button>
              <button ref={agreementSubmitRef} type="submit" className="btn btn-primary">{text.agree}</button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
