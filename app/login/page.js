'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './login.module.css';
import { useI18n } from '../i18n/I18nProvider';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { t } = useI18n();

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();

      if (data.success) {
        const urlParams = new URLSearchParams(window.location.search);
        let nextPath = urlParams.get('next') || '/dashboard';
        if (nextPath.startsWith('/admin') && data.user.role !== 'admin') nextPath = '/dashboard';
        router.push(nextPath);
      } else {
        setError(data.error || t('auth.loginFailed'));
      }
    } catch {
      setError(t('auth.networkError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <div className={styles.formPanel}>
          <div className={styles.brand}>
            <div className={styles.logo}><span>✦</span> OfficeGPT</div>
            <p>{t('auth.welcome')}</p>
          </div>

          {error && <div className={styles.error} role="alert">{error}</div>}

          <form onSubmit={handleLogin} className={styles.form}>
            <label>
              <span>{t('auth.email')}</span>
              <input type="email" className="input-base" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="name@example.com" autoComplete="email" />
            </label>
            <label>
              <span>{t('auth.password')}</span>
              <input type="password" className="input-base" value={password} onChange={(event) => setPassword(event.target.value)} required placeholder="••••••••" autoComplete="current-password" />
            </label>
            <button type="submit" className={`btn btn-primary ${styles.loginButton}`} disabled={loading}>
              {loading ? t('auth.signingIn') : t('auth.login')}
            </button>
          </form>

          <p className={styles.forgot}><a href="/forgot-password">忘记密码？</a></p>
          <p className={styles.register}>{t('auth.noAccount')} <a href="/register">{t('auth.registerBonus')}</a></p>
        </div>
      </section>
    </main>
  );
}
