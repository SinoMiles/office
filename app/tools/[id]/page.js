import { getToolById, getAllTools } from '@/lib/toolsData';
import ToolProcessClient from './ToolProcessClient';
import { notFound } from 'next/navigation';
import { absoluteUrl } from '@/lib/seo';
import { headers } from 'next/headers';
import { normalizeLocale } from '@/app/i18n/config';
import { publicMetadata, localizedPath } from '@/app/i18n/publicSeo';
import { localizedToolName } from '@/app/i18n/toolNames';

export async function generateMetadata({ params }) {
  const { id } = await params;
  const tool = getToolById(id);
  const locale = normalizeLocale((await headers()).get('x-office-locale'));
  
  if (!tool) {
    return {
      title: '工具未找到 | OfficeGPT',
      robots: { index: false, follow: false },
    }
  }

  const name = localizedToolName(tool, locale);
  const generic = `${name} | OfficeGPT`;
  const description = locale === 'zh-CN' ? (tool.seo?.summary || tool.desc) : `${name} — fast, secure online document processing with OfficeGPT.`;
  const shared = publicMetadata(locale, `/tools/${tool.id}`);
  return {
    ...shared,
    title: locale === 'zh-CN' ? `${tool.name} - 免费在线文档工具 | OfficeGPT` : generic,
    description,
    keywords: [name, 'OfficeGPT', 'document tools'],
    openGraph: {
      ...shared.openGraph,
      title: locale === 'zh-CN' ? `${tool.name} - 免费在线文档工具 | OfficeGPT` : generic,
      description,
      url: localizedPath(locale, `/tools/${tool.id}`),
    }
  }
}

export function generateStaticParams() {
  return getAllTools().filter((tool) => !tool.comingSoon).map((tool) => ({ id: tool.id }));
}

export default async function ToolPage({ params }) {
  const { id } = await params;
  const tool = getToolById(id);
  if (!tool || tool.comingSoon) notFound();
  const locale = normalizeLocale((await headers()).get('x-office-locale'));
  const name = localizedToolName(tool, locale);
  const route = localizedPath(locale, `/tools/${tool.id}`);
  const faq = locale === 'zh-CN' ? (tool?.seo?.faqs || []) : [];
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        name,
        url: absoluteUrl(route),
        description: locale === 'zh-CN' ? (tool.seo?.summary || tool.desc) : `${name} — OfficeGPT online document processing tool.`,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'CNY' },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'OfficeGPT', item: absoluteUrl(localizedPath(locale, '/')) },
          { '@type': 'ListItem', position: 2, name: 'Document tools', item: absoluteUrl(localizedPath(locale, '/tools')) },
          { '@type': 'ListItem', position: 3, name, item: absoluteUrl(route) },
        ],
      },
      ...(faq.length ? [{ '@type': 'FAQPage', mainEntity: faq.map(([question, answer]) => ({ '@type': 'Question', name: question, acceptedAnswer: { '@type': 'Answer', text: answer } })) }] : []),
    ],
  };
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }} /><ToolProcessClient /></>;
}
