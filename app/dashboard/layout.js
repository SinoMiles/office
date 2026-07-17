import DashboardClient from './DashboardClient';

export const metadata = {
  title: '工作台 | OfficeGPT',
  robots: {
    index: false,
    follow: false,
  },
}

export default function DashboardLayout({ children }) {
  return (
    <DashboardClient>
      {children}
    </DashboardClient>
  );
}
