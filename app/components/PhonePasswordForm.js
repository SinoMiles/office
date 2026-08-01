'use client';

import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function PhonePasswordForm() {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (password.length < 8) return toast.error('密码至少需要 8 位');
    if (password !== confirmation) return toast.error('两次输入的密码不一致');
    setSaving(true);
    try {
      const response = await fetch('/api/auth/phone/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || '密码设置失败');
      setPassword('');
      setConfirmation('');
      toast.success('登录密码已更新');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: '12px', padding: '16px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'white' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
        <KeyRound size={18} color="var(--primary)" />
        <strong style={{ fontSize: '0.92rem' }}>设置登录密码</strong>
      </div>
      <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.8rem', lineHeight: 1.6 }}>设置后可以在登录页使用手机号和密码登录，也可以继续使用短信验证码。</p>
      <input type="password" className="input-base" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} maxLength={128} autoComplete="new-password" placeholder="新密码，至少 8 位" required />
      <input type="password" className="input-base" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} minLength={8} maxLength={128} autoComplete="new-password" placeholder="再次输入新密码" required />
      <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? '保存中…' : '保存密码'}</button>
    </form>
  );
}
