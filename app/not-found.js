import Link from 'next/link';
import { headers } from 'next/headers';
import { getAllTools } from '@/lib/toolsData';
import { normalizeLocale } from '@/app/i18n/config';
import { localizedToolName } from '@/app/i18n/toolNames';

export const metadata = {
  title: '页面未找到 | OfficeGPT',
  robots: { index: false, follow: true },
};

const COPY = {
  'zh-CN': {
    code: '404',
    title: '这个页面不存在',
    body: '链接可能已经失效，或者地址输错了。下面这些常用工具或许正是你要找的。',
    popular: '热门工具',
    all: '浏览全部 50 个工具',
    home: '返回首页',
  },
  en: {
    code: '404',
    title: 'This page does not exist',
    body: 'The link may be out of date, or the address was mistyped. One of these popular tools might be what you were after.',
    popular: 'Popular tools',
    all: 'Browse all 50 tools',
    home: 'Back to home',
  },
};

// 404 之前用的是 Next 默认页 —— 一个死胡同。改成引导页把误入的流量导向工具列表，
// 同时 robots 设为 noindex 但 follow，让权重继续流向内链而不是在这里断掉。
const HIGHLIGHTED = ['word-to-pdf', 'merge-pdf', 'pdf-to-text', 'excel-to-csv', 'split-pdf', 'img-to-pdf', 'pdf-to-jpg', 'encrypt'];

export default async function NotFound() {
  const locale = normalizeLocale((await headers()).get('x-office-locale'));
  const copy = COPY[locale] || COPY['zh-CN'];
  const tools = getAllTools();
  const picks = HIGHLIGHTED.map((id) => tools.find((tool) => tool.id === id)).filter(Boolean);

  return (
    <main className="container" style={{ padding: '96px 20px', maxWidth: '840px', margin: '0 auto', textAlign: 'center' }}>
      <div style={{ fontSize: '5rem', fontWeight: 800, lineHeight: 1, color: 'var(--primary)', opacity: 0.22 }}>{copy.code}</div>
      <h1 style={{ fontSize: '1.9rem', fontWeight: 800, margin: '14px 0 12px' }}>{copy.title}</h1>
      <p style={{ color: 'var(--text-muted)', lineHeight: 1.8, maxWidth: '560px', margin: '0 auto 34px' }}>{copy.body}</p>

      <h2 style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '14px' }}>{copy.popular}</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center', marginBottom: '34px' }}>
        {picks.map((tool) => (
          <Link
            key={tool.id}
            href={`/tools/${tool.id}`}
            style={{ padding: '10px 16px', borderRadius: '10px', background: 'white', border: '1px solid var(--border)', color: 'var(--text-main)', textDecoration: 'none', fontSize: '0.9rem' }}
          >
            {localizedToolName(tool, locale)}
          </Link>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link href="/tools" className="btn btn-primary" style={{ padding: '12px 22px' }}>{copy.all}</Link>
        <Link href="/" className="btn btn-outline" style={{ padding: '12px 22px' }}>{copy.home}</Link>
      </div>
    </main>
  );
}
