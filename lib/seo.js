const FALLBACK_SITE_URL = 'http://localhost:3000';

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
