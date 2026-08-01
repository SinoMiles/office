'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import AdminSidebar from './AdminSidebar';
import AdminHeader from './AdminHeader';

export default function AdminShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === '/admin/login';
  const [state, setState] = useState({ loading: !isLogin, user: null });

  useEffect(() => {
    if (isLogin) {
      return;
    }
    let active = true;
    fetch('/api/admin/auth/session', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('unauthorized');
        return response.json();
      })
      .then((payload) => active && setState({ loading: false, user: payload.user }))
      .catch(() => active && router.replace('/admin/login'));
    return () => { active = false; };
  }, [isLogin, router]);

  if (isLogin) return children;
  if (state.loading || !state.user) {
    return (
      <main className="admin-auth-loading">
        <span className="admin-auth-spinner" />
        <p>正在验证管理会话…</p>
      </main>
    );
  }

  return (
    <div className="admin-shell">
      <AdminSidebar user={state.user} />
      <div className="admin-shell-main">
        <AdminHeader user={state.user} />
        <main className="admin-shell-content">{children}</main>
      </div>
    </div>
  );
}
