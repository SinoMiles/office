import { getToolById, getAllTools } from '@/lib/toolsData';
import ToolProcessClient from './ToolProcessClient';
import { notFound } from 'next/navigation';
import { absoluteUrl } from '@/lib/seo';

export async function generateMetadata({ params }) {
  const { id } = await params;
  const tool = getToolById(id);
  
  if (!tool) {
    return {
      title: '工具未找到 | OfficeGPT',
      robots: { index: false, follow: false },
    }
  }

  return {
    title: `${tool.name} - 免费在线文档工具 | OfficeGPT`,
    description: tool.seo?.summary || tool.desc,
    keywords: [tool.name, tool.desc, '免费在线工具', '文档处理'],
    alternates: { canonical: `/tools/${tool.id}` },
    openGraph: {
      title: `${tool.name} - 免费在线文档工具 | OfficeGPT`,
      description: tool.seo?.summary || tool.desc,
      url: `/tools/${tool.id}`,
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
  const faq = tool?.seo?.faqs || [];
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        name: tool.name,
        url: absoluteUrl(`/tools/${tool.id}`),
        description: tool.seo?.summary || tool.desc,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'CNY' },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: '首页', item: absoluteUrl('/') },
          { '@type': 'ListItem', position: 2, name: '文档工具', item: absoluteUrl('/tools') },
          { '@type': 'ListItem', position: 3, name: tool.name, item: absoluteUrl(`/tools/${tool.id}`) },
        ],
      },
      ...(faq.length ? [{ '@type': 'FAQPage', mainEntity: faq.map(([question, answer]) => ({ '@type': 'Question', name: question, acceptedAnswer: { '@type': 'Answer', text: answer } })) }] : []),
    ],
  };
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }} /><ToolProcessClient /></>;
}
