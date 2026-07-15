import { Inter } from 'next/font/google'
import './globals.css'
import { cookies } from 'next/headers'

const inter = Inter({ subsets: ['latin'] })

import TopNav from './components/TopNav'
import { Toaster } from 'react-hot-toast'
import { getSiteUrl } from '@/lib/seo'

export const metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: 'OfficeGPT - 全能 AI 智能办公套件与文档处理大厅',
  description: '全球首个专为 AI 智能体设计的 Office 套件，让 AI 帮你做 Excel、PPT 和 Word。基于大语言模型驱动，提供自然语言交互的办公自动化解决方案。',
  keywords: ['OfficeGPT', 'AI智能办公套件', 'AI文档处理', 'Excel助手', '自动生成PPT', 'Word智能排版', '办公自动化 SaaS', '数据处理', '深圳市星尚硕教育科技有限公司'],
  authors: [{ name: '深圳市星尚硕教育科技有限公司' }],
  creator: '深圳市星尚硕教育科技有限公司',
  publisher: '深圳市星尚硕教育科技有限公司',
  robots: {
    index: true,
    follow: true,
  },
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    title: 'OfficeGPT - 全能 AI 智能办公套件',
    description: '打破软件操作壁垒，将您的自然语言直接转化为精准的文档计算结果。',
    siteName: 'OfficeGPT',
    url: '/',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OfficeGPT - 全能 AI 智能办公套件',
    description: '让每一个职场人和教育工作者都能通过自然语言解决复杂的数据难题。',
  },
}

export default async function RootLayout({ children }) {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  const isLoggedIn = !!token;

  return (
    <html lang="zh-CN">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "Organization",
                  "@id": `${getSiteUrl()}/#organization`,
                  "name": "深圳市星尚硕教育科技有限公司",
                  "url": getSiteUrl()
                },
                {
                  "@type": "SoftwareApplication",
                  "@id": `${getSiteUrl()}/#application`,
                  "name": "OfficeGPT",
                  "url": getSiteUrl(),
                  "applicationCategory": "BusinessApplication",
                  "operatingSystem": "Web",
                  "offers": { "@type": "Offer", "price": "0", "priceCurrency": "CNY" },
                  "publisher": { "@id": `${getSiteUrl()}/#organization` }
                }
              ]
            })
          }}
        />
      </head>
      <body className={inter.className}>
        <Toaster position="top-center" toastOptions={{ style: { borderRadius: '12px', background: '#333', color: '#fff' } }} />
        <TopNav isLoggedIn={isLoggedIn} />

        {children}
      </body>
    </html>
  );
}
