import { getToolById, getAllTools } from '@/lib/toolsData';
import ToolProcessClient from './ToolProcessClient';

export async function generateMetadata({ params }) {
  const { id } = await params;
  const tool = getToolById(id);
  
  if (!tool) {
    return {
      title: '工具未找到 | OfficeGPT'
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
    }
  }
}

export function generateStaticParams() {
  return getAllTools().filter((tool) => !tool.comingSoon).map((tool) => ({ id: tool.id }));
}

export default async function ToolPage({ params }) {
  const { id } = await params;
  const tool = getToolById(id);
  const faq = tool?.seo?.faqs || [];
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: tool?.name,
    description: tool?.seo?.summary || tool?.desc,
    applicationCategory: 'BusinessApplication',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'CNY' },
    mainEntity: faq.length ? { '@type': 'FAQPage', mainEntity: faq.map(([question, answer]) => ({ '@type': 'Question', name: question, acceptedAnswer: { '@type': 'Answer', text: answer } })) } : undefined,
  };
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }} /><ToolProcessClient /></>;
}
