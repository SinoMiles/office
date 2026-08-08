import { Inter } from 'next/font/google'
import './globals.css'
import { cookies, headers } from 'next/headers'

const inter = Inter({ subsets: ['latin'] })

import TopNav from './components/TopNav'
import { Toaster } from 'react-hot-toast'
import { getSiteUrl } from '@/lib/seo'
import { I18nProvider } from './i18n/I18nProvider'
import { LOCALE_COOKIE, LOCALE_EXPLICIT_COOKIE, normalizeLocale } from './i18n/config'
import { publicMetadata } from './i18n/publicSeo'

const baseMetadata = {
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

export async function generateMetadata() {
  const headerStore = await headers();
  const locale = normalizeLocale(headerStore.get('x-office-locale') || headerStore.get('accept-language'));
  const publicPath = headerStore.get('x-office-public-path');
  return publicPath ? { ...baseMetadata, ...publicMetadata(locale, publicPath.replace(/^\/[a-z-]+(?=\/|$)/, '') || '/') } : baseMetadata;
}

export default async function RootLayout({ children }) {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  const isLoggedIn = !!token;
  const headerStore = await headers();
  const explicitLocale = cookieStore.get(LOCALE_EXPLICIT_COOKIE)?.value === '1'
    ? cookieStore.get(LOCALE_COOKIE)?.value
    : null;
  const locale = normalizeLocale(headerStore.get('x-office-locale') || explicitLocale || headerStore.get('accept-language'));

  return (
    <html lang={locale} data-scroll-behavior="smooth">
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
                },
                {
                  "@type": "WebSite",
                  "@id": `${getSiteUrl()}/#website`,
                  "name": "OfficeGPT",
                  "url": getSiteUrl(),
                  "publisher": { "@id": `${getSiteUrl()}/#organization` }
                }
              ]
            })
          }}
        />
      </head>
      <body className={inter.className}>
        <I18nProvider initialLocale={locale}>
          <Toaster position="top-center" toastOptions={{ style: { borderRadius: '12px', background: '#333', color: '#fff' } }} />
          <TopNav isLoggedIn={isLoggedIn} />
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
