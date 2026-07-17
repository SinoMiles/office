'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './login.module.css';

const QR_REFRESH_MS = 4 * 60 * 1000;

function WechatIcon() {
  return (
    <svg viewBox="0 0 1024 1024" width="22" height="22" aria-hidden="true">
      <path d="M685.257 588.225c-85.39 0-154.596-59.508-154.596-132.884 0-73.351 69.206-132.908 154.596-132.908 85.39 0 154.57 59.557 154.57 132.908 0 73.376-69.18 132.884-154.57 132.884z m-356.124-78.361c-112.593 0-203.951-78.434-203.951-175.253 0-96.843 91.358-175.325 203.951-175.325 112.592 0 203.974 78.482 203.974 175.325 0 96.82-91.382 175.253-203.974 175.253z m654.516 46.852c0-101.465-103.541-183.743-231.258-183.743-16.14 0-31.914 1.348-47.16 3.916-25.045-81.821-114.73-141.446-218.423-141.446-126.963 0-229.897 86.811-229.897 193.945 0 58.73 31.026 111.391 79.52 146.471l-24.996 74.457 88.087-43.518c27.172 7.747 56.402 12.016 87.288 12.016 11.233 0 22.251-.674 33.003-1.898 33.193 57.378 100.899 96.657 178.682 96.657 23.36 0 45.69-3.328 66.425-9.356l68.791 34.02-19.535-58.156c38.019-27.424 62.483-66.241 62.483-109.912z" fill="currentColor" />
    </svg>
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [qrVersion, setQrVersion] = useState(0);
  const router = useRouter();

  useEffect(() => {
    const refresh = () => setQrVersion(Date.now());
    refresh();
    const timer = window.setInterval(refresh, QR_REFRESH_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

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
        setError(data.error || '登录失败，请稍后重试');
      }
    } catch {
      setError('网络错误，请检查服务是否正常运行');
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
            <p>欢迎回来，请登录您的账户</p>
          </div>

          {error && <div className={styles.error} role="alert">{error}</div>}

          <form onSubmit={handleLogin} className={styles.form}>
            <label>
              <span>邮箱</span>
              <input type="email" className="input-base" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="name@example.com" autoComplete="email" />
            </label>
            <label>
              <span>密码</span>
              <input type="password" className="input-base" value={password} onChange={(event) => setPassword(event.target.value)} required placeholder="••••••••" autoComplete="current-password" />
            </label>
            <button type="submit" className={`btn btn-primary ${styles.loginButton}`} disabled={loading}>
              {loading ? '登录中…' : '登 录'}
            </button>
          </form>

          <p className={styles.register}>还没有账号？ <a href="/register">免费注册获赠 10,000 Credits</a></p>
        </div>

        <aside className={styles.wechatPanel}>
          <div className={styles.wechatTitle}><WechatIcon /><span>微信扫码登录</span></div>
          <p className={styles.wechatHint}>打开微信扫一扫，无需输入密码</p>
          <div className={styles.qrFrame}>
            <iframe key={qrVersion} src={`/api/auth/wechat?embed=1${qrVersion ? `&t=${qrVersion}` : ''}`} title="微信登录二维码" scrolling="no" />
          </div>
          <p className={styles.wechatLegal}>扫码即表示同意<a href="/terms">服务条款</a>与<a href="/privacy">隐私政策</a></p>
        </aside>
      </section>
    </main>
  );
}
