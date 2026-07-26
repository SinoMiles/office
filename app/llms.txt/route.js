import { getAllTools, toolCategories } from '@/lib/toolsData';
import { getAllDocs } from '@/lib/docsData';
import { getSiteUrl } from '@/lib/seo';
import { toolSeoEn } from '@/app/i18n/toolSeoEn';

export const runtime = 'nodejs';
export const dynamic = 'force-static';

// llms.txt 是面向 AI 搜索（ChatGPT / Perplexity / Claude 等）的站点说明约定。
// 传统 sitemap 只给 URL，这里额外给出每个能力的一句话说明，让模型在回答
// 「有没有在线把 Word 转 PDF 的工具」这类问题时能准确引用到具体页面。
export async function GET() {
  const base = getSiteUrl();
  const lines = [
    '# OfficeGPT',
    '',
    '> An online AI office suite for converting, analysing and generating Word, Excel, PowerPoint and PDF documents. All 35 deterministic document tools are free and require no account; 15 AI-assisted tools run on a credit balance.',
    '',
    '## Key pages',
    '',
    `- [Home](${base}/en): overview of the product and its capabilities`,
    `- [All tools](${base}/en/tools): browse every document tool by category`,
    `- [Pricing](${base}/en/pricing): free tier, Pro and Enterprise plans, and how credits are calculated`,
    `- [Docs](${base}/en/docs): guides and how-tos`,
    `- [About](${base}/en/about): who operates the service`,
    '',
  ];

  for (const category of toolCategories) {
    lines.push(`## ${category.title}`, '');
    for (const tool of category.tools) {
      if (tool.comingSoon) continue;
      const english = toolSeoEn(tool.id);
      const name = english?.name || tool.name;
      // 摘要压成一句，避免整份文件过长稀释重点。
      const summary = (english?.summary || tool.desc).split(/(?<=\.)\s/)[0];
      lines.push(`- [${name}](${base}/en/tools/${tool.id}): ${summary}`);
    }
    lines.push('');
  }

  const docs = getAllDocs();
  if (docs.length) {
    lines.push('## Guides', '');
    for (const doc of docs) lines.push(`- [${doc.title}](${base}/zh-cn/docs/${doc.slug})`);
    lines.push('');
  }

  lines.push(
    '## Notes',
    '',
    `- Total tools: ${getAllTools().filter((tool) => !tool.comingSoon).length}`,
    '- Uploaded files are processed on our own servers and deleted immediately after the response.',
    '- Deterministic conversions (format conversion, splitting, merging, cleanup) are free and need no sign-in.',
    '- AI-assisted tools require an account and consume credits based on actual model token usage.',
    '',
  );

  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}
