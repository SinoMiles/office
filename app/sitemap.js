import { getAllTools } from '@/lib/toolsData';
import { getAllDocs } from '@/lib/docsData';
import { getSiteUrl } from '@/lib/seo';

export default function sitemap() {
  const baseUrl = getSiteUrl();
  const staticPages = ['', '/tools', '/about', '/privacy', '/terms'].map((path) => ({
    url: `${baseUrl}${path}`,
    changeFrequency: path === '/tools' ? 'weekly' : 'monthly',
    priority: path === '' ? 1 : 0.8,
  }));
  const toolPages = getAllTools().filter((tool) => !tool.comingSoon).map((tool) => ({
    url: `${baseUrl}/tools/${tool.id}`,
    changeFrequency: 'monthly',
    priority: 0.7,
  }));
  const docPages = getAllDocs().map((doc) => ({
    url: `${baseUrl}/docs/${doc.slug}`,
    changeFrequency: 'monthly',
    priority: 0.65,
  }));
  return [...staticPages, ...toolPages, ...docPages];
}
