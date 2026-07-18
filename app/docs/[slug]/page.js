import { getAllDocs, getDocBySlug } from '@/lib/docsData';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { headers } from 'next/headers';
import { normalizeLocale } from '@/app/i18n/config';
import { publicMetadata } from '@/app/i18n/publicSeo';

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const doc = getDocBySlug(slug);
  const locale = normalizeLocale((await headers()).get('x-office-locale'));
  
  if (!doc) {
    return {
      title: '文档未找到 | OfficeGPT',
      robots: { index: false, follow: false },
    }
  }

  const shared = publicMetadata(locale, `/docs/${doc.slug}`);
  const title = locale === 'zh-CN' ? `${doc.title} - 帮助文档 | OfficeGPT` : `OfficeGPT Help Center`;
  return { ...shared, title, description: locale === 'zh-CN' ? `阅读关于 ${doc.title} 的详细介绍。` : shared.description, openGraph: { ...shared.openGraph, title } };
}

export function generateStaticParams() {
  return getAllDocs().map((doc) => ({ slug: doc.slug }));
}

export default async function DocPage({ params }) {
  const { slug } = await params;
  const doc = getDocBySlug(slug);

  if (!doc) {
    notFound();
  }

  return (
    <article className="markdown-body" style={{ paddingBottom: '80px' }}>
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]}
        components={{
          code({node, inline, className, children, ...props}) {
            const match = /language-(\w+)/.exec(className || '')
            return !inline && match ? (
              <SyntaxHighlighter
                style={oneLight}
                language={match[1]}
                PreTag="div"
                {...props}
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            ) : (
              <code className={className} {...props} style={{ background: 'var(--primary-light)', color: 'var(--primary)', padding: '2px 4px', borderRadius: '4px' }}>
                {children}
              </code>
            )
          },
          h1: ({node, ...props}) => <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '16px', color: 'var(--text-main)' }} {...props} />,
          h2: ({node, ...props}) => <h2 style={{ fontSize: '1.8rem', fontWeight: 700, marginTop: '40px', marginBottom: '16px', color: 'var(--text-main)' }} {...props} />,
          h3: ({node, ...props}) => <h3 style={{ fontSize: '1.3rem', fontWeight: 600, marginTop: '24px', marginBottom: '12px', color: 'var(--text-main)' }} {...props} />,
          p: ({node, ...props}) => <p style={{ fontSize: '1.1rem', lineHeight: 1.8, marginBottom: '16px', color: 'var(--text-muted)' }} {...props} />,
          ul: ({node, ...props}) => <ul style={{ fontSize: '1.1rem', lineHeight: 1.8, marginBottom: '24px', color: 'var(--text-muted)', paddingLeft: '24px' }} {...props} />,
          li: ({node, ...props}) => <li style={{ marginBottom: '8px' }} {...props} />,
          blockquote: ({node, ...props}) => <blockquote style={{ borderLeft: '4px solid var(--primary)', paddingLeft: '16px', margin: '24px 0', fontStyle: 'italic', color: 'var(--text-muted)', background: 'var(--primary-light)', padding: '16px', borderRadius: '0 8px 8px 0' }} {...props} />
        }}
      >
        {doc.content}
      </ReactMarkdown>
    </article>
  );
}
