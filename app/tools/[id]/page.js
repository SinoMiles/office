import { getToolById, getAllTools } from '@/lib/toolsData';
import ToolProcessClient from './ToolProcessClient';
import { notFound } from 'next/navigation';
import { absoluteUrl } from '@/lib/seo';
import { headers } from 'next/headers';
import { normalizeLocale } from '@/app/i18n/config';
import { publicMetadata, localizedPath } from '@/app/i18n/publicSeo';
import { localizedToolName } from '@/app/i18n/toolNames';
import { toolContent } from '@/app/i18n/toolContent';

const HOW_TO_STEPS = {
  'zh-CN': (name) => [
    ['上传文件', `在 ${name} 页面点击上传区域，或直接把文件拖进来。`],
    ['开始处理', '确认所需选项后点击处理按钮，文件在服务器端完成转换。'],
    ['下载结果', '处理完成后立即下载新文件，原始文件不会被修改。'],
  ],
  en: (name) => [
    ['Upload your file', `Open ${name} and click the upload area, or drag a file straight onto the page.`],
    ['Run the tool', 'Set any options the tool offers, then start processing. The work happens on our servers.'],
    ['Download the result', 'Grab the new file as soon as it is ready. Your original file is never modified.'],
  ],
};

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
  const content = toolContent(tool, locale);
  const description = content?.summary || tool.desc;
  const shared = publicMetadata(locale, `/tools/${tool.id}`);
  const title = locale === 'zh-CN'
    ? `${tool.name} - 免费在线文档工具 | OfficeGPT`
    : `${name} - Free Online Document Tool | OfficeGPT`;
  return {
    ...shared,
    title,
    description,
    keywords: [name, 'OfficeGPT', 'document tools'],
    openGraph: {
      ...shared.openGraph,
      title,
      description,
      url: localizedPath(locale, `/tools/${tool.id}`),
    },
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
  const content = toolContent(tool, locale);
  // 只有真实撰写过内容的语种才输出 FAQPage —— 把模板化的问答喂给搜索引擎
  // 会被判定为重复内容，损失比不输出更大。
  const faq = content?.faqs || [];
  const steps = (HOW_TO_STEPS[locale] || HOW_TO_STEPS.en)(name);
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        name,
        url: absoluteUrl(route),
        description: content?.summary || tool.desc,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'CNY' },
      },
      {
        '@type': 'HowTo',
        name: locale === 'zh-CN' ? `如何使用${name}` : `How to use ${name}`,
        description: content?.summary || tool.desc,
        totalTime: 'PT1M',
        step: steps.map(([stepName, text], index) => ({
          '@type': 'HowToStep',
          position: index + 1,
          name: stepName,
          text,
          url: `${absoluteUrl(route)}#step-${index + 1}`,
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'OfficeGPT', item: absoluteUrl(localizedPath(locale, '/')) },
          { '@type': 'ListItem', position: 2, name: locale === 'zh-CN' ? '文档工具' : 'Document tools', item: absoluteUrl(localizedPath(locale, '/tools')) },
          { '@type': 'ListItem', position: 3, name, item: absoluteUrl(route) },
        ],
      },
      ...(faq.length ? [{ '@type': 'FAQPage', mainEntity: faq.map(([question, answer]) => ({ '@type': 'Question', name: question, acceptedAnswer: { '@type': 'Answer', text: answer } })) }] : []),
    ],
  };
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }} /><ToolProcessClient /></>;
}
