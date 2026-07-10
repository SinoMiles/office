import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { LayoutDashboard, Users, Settings, LogOut } from 'lucide-react';

import AdminSidebar from './components/AdminSidebar';
import AdminHeader from './components/AdminHeader';

export default async function AdminLayout({ children }) {
  const user = await getCurrentUser();
  
  if (!user || user.role !== 'admin') {
    redirect('/login?next=/admin');
  }

  // Convert mongoose object to plain object for Client Component
  const plainUser = { email: user.email, role: user.role };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--background)' }}>
      {/* Sidebar */}
      <AdminSidebar user={plainUser} />

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <AdminHeader user={plainUser} />
        <main style={{ flex: 1, padding: '32px', overflowY: 'auto' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
