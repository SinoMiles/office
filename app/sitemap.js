import { getAllTools } from '@/lib/toolsData';
import { getAllDocs } from '@/lib/docsData';
import { getSiteUrl } from '@/lib/seo';
import { SUPPORTED_LOCALES } from '@/app/i18n/config';
import { languageAlternates, localizedPath } from '@/app/i18n/publicSeo';

export default function sitemap() {
  const baseUrl = getSiteUrl();
  const paths = [
    ...['/', '/tools', '/about', '/privacy', '/terms'],
    ...getAllTools().filter((tool) => !tool.comingSoon).map((tool) => `/tools/${tool.id}`),
    ...getAllDocs().map((doc) => `/docs/${doc.slug}`),
  ];
  return paths.flatMap((path) => SUPPORTED_LOCALES.map(({ code }) => ({
    url: `${baseUrl}${localizedPath(code, path)}`,
    changeFrequency: path === '/tools' ? 'weekly' : 'monthly',
    priority: path === '/' ? 1 : path.startsWith('/tools/') ? 0.7 : path.startsWith('/docs/') ? 0.65 : 0.8,
    alternates: { languages: Object.fromEntries(Object.entries(languageAlternates(path)).map(([locale, href]) => [locale, `${baseUrl}${href}`])) },
  })));
}
