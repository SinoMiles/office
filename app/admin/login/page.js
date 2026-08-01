'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react';
import BrandMark from '@/app/components/BrandMark';
import styles from './page.module.css';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('sino_miles@foxmail.com');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/auth/session', { cache: 'no-store' }).then((response) => {
      if (response.ok) router.replace('/admin');
    }).catch(() => undefined);
  }, [router]);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || '登录失败');
      router.replace('/admin');
      router.refresh();
    } catch (loginError) {
      setError(loginError.message || '登录失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.glowOne} />
      <div className={styles.glowTwo} />
      <section className={styles.card}>
        <div className={styles.brand}><BrandMark size={42} radius={12} /><span>OfficeGPT</span></div>
        <h1>管理员登录</h1>
        <p className={styles.subtitle}>请输入管理员账号和密码</p>
        {error && <div className={styles.error} role="alert">{error}</div>}
        <form onSubmit={handleSubmit} className={styles.form}>
          <label>
            <span>管理员账号</span>
            <div className={styles.inputWrap}><Mail size={18} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required /></div>
          </label>
          <label>
            <span>密码</span>
            <div className={styles.inputWrap}><LockKeyhole size={18} /><input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? '隐藏密码' : '显示密码'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
          </label>
          <button className={styles.submit} type="submit" disabled={loading}>{loading ? '正在验证…' : '进入管理后台'}</button>
        </form>
      </section>
    </main>
  );
}
