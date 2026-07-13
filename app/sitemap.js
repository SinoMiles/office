import { getAllTools } from '@/lib/toolsData';

export default function sitemap() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const now = new Date();
  const staticPages = ['', '/tools', '/pricing', '/docs'].map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: now,
    changeFrequency: path === '/tools' ? 'weekly' : 'monthly',
    priority: path === '' ? 1 : 0.8,
  }));
  const toolPages = getAllTools().filter((tool) => !tool.comingSoon).map((tool) => ({
    url: `${baseUrl}/tools/${tool.id}`,
    lastModified: now,
    changeFrequency: 'monthly',
    priority: 0.7,
  }));
  return [...staticPages, ...toolPages];
}
