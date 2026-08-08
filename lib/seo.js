// Canonical、Open Graph 与 sitemap 绝不能在生产配置遗漏时回退到
// localhost，否则搜索引擎会把正式页面的权重指向一个不可访问的地址。
const FALLBACK_SITE_URL = 'https://officegoai.com';

export function getSiteUrl() {
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  const configured = String(
    process.env.NEXT_PUBLIC_SITE_URL || (vercelHost ? `https://${vercelHost}` : FALLBACK_SITE_URL),
  ).trim();
  return configured.replace(/\/+$/, '');
}

export function absoluteUrl(pathname = '/') {
  return new URL(pathname, `${getSiteUrl()}/`).toString();
}
