import { getAllTools } from '@/lib/toolsData';
import { getAllDocs } from '@/lib/docsData';
import { getSiteUrl } from '@/lib/seo';
import { SUPPORTED_LOCALES } from '@/app/i18n/config';
import { languageAlternates, localizedPath } from '@/app/i18n/publicSeo';

function priorityFor(path) {
  if (path === '/') return 1;
  if (path === '/pricing') return 0.9;
  if (path === '/tools') return 0.85;
  if (path.startsWith('/tools/')) return 0.7;
  if (path.startsWith('/docs/')) return 0.65;
  return 0.5;
}

function changeFrequencyFor(path) {
  if (path === '/' || path === '/tools' || path === '/pricing') return 'weekly';
  if (path.startsWith('/docs/')) return 'monthly';
  return 'yearly';
}

export default function sitemap() {
  const baseUrl = getSiteUrl();
  const localizedPaths = [
    ...['/', '/tools', '/pricing'],
    ...getAllTools().filter((tool) => !tool.comingSoon).map((tool) => `/tools/${tool.id}`),
  ];
  const chineseOnlyPaths = [
    '/about', '/privacy', '/terms',
    ...getAllDocs().map((doc) => `/docs/${doc.slug}`),
  ];
  const localizedEntries = localizedPaths.flatMap((path) => SUPPORTED_LOCALES.map(({ code }) => ({
    url: `${baseUrl}${localizedPath(code, path)}`,
    changeFrequency: changeFrequencyFor(path),
    priority: priorityFor(path),
    alternates: { languages: Object.fromEntries(Object.entries(languageAlternates(path)).map(([locale, href]) => [locale, `${baseUrl}${href}`])) },
  })));
  const chineseEntries = chineseOnlyPaths.map((path) => ({
    url: `${baseUrl}${localizedPath('zh-CN', path)}`,
    changeFrequency: changeFrequencyFor(path),
    priority: priorityFor(path),
  }));
  return [...localizedEntries, ...chineseEntries];
}
