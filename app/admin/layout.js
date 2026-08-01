import AdminShell from './components/AdminShell';

export const metadata = {
  title: 'OfficeGPT 管理后台',
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }) {
  return <AdminShell>{children}</AdminShell>;
}
