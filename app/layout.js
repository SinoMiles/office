import { Inter } from 'next/font/google'
import './globals.css'
import { cookies } from 'next/headers'

const inter = Inter({ subsets: ['latin'] })

import TopNav from './components/TopNav'
import { Toaster } from 'react-hot-toast'

export const metadata = {
  title: 'OfficeGPT - AI 智能办公套件',
  description: '全球首个专为 AI 智能体设计的 Office 套件，让 AI 帮你做 Excel、PPT 和 Word。',
}

export default async function RootLayout({ children }) {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  const isLoggedIn = !!token;

  return (
    <html lang="zh-CN">
      <body className={inter.className}>
        <Toaster position="top-center" toastOptions={{ style: { borderRadius: '12px', background: '#333', color: '#fff' } }} />
        <TopNav isLoggedIn={isLoggedIn} />

        {children}
      </body>
    </html>
  );
}
