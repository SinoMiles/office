import { NextResponse } from 'next/server';
import { LOCALE_COOKIE, LOCALE_EXPLICIT_COOKIE, normalizeLocale } from '@/app/i18n/config';

const localeSegments = { 'zh-CN': 'zh-cn', en: 'en', ja: 'ja', ko: 'ko', es: 'es', pt: 'pt', fr: 'fr', de: 'de' };
const segmentLocales = Object.fromEntries(Object.entries(localeSegments).map(([locale, segment]) => [segment, locale]));
const publicRoots = new Set(['', 'tools', 'about', 'docs', 'privacy', 'terms', 'login', 'register', 'forgot-password']);

export function proxy(request) {
  const { pathname } = request.nextUrl;
  const parts = pathname.split('/').filter(Boolean);
  const routeLocale = segmentLocales[parts[0]?.toLowerCase()];

  if (routeLocale) {
    const internalPath = `/${parts.slice(1).join('/')}` || '/';
    const internalRoot = parts[1] || '';
    if (!publicRoots.has(internalRoot)) return NextResponse.next();
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-office-locale', routeLocale);
    requestHeaders.set('x-office-public-path', pathname);
    const url = request.nextUrl.clone();
    url.pathname = internalPath;
    const response = NextResponse.rewrite(url, { request: { headers: requestHeaders } });
    response.cookies.set(LOCALE_COOKIE, routeLocale, { path: '/', sameSite: 'lax', maxAge: 31536000 });
    return response;
  }

  const root = parts[0] || '';
  if (!publicRoots.has(root)) return NextResponse.next();
  const explicitLocale = request.cookies.get(LOCALE_EXPLICIT_COOKIE)?.value === '1'
    ? request.cookies.get(LOCALE_COOKIE)?.value
    : null;
  const locale = normalizeLocale(explicitLocale || request.headers.get('accept-language'));
  const url = request.nextUrl.clone();
  url.pathname = `/${localeSegments[locale]}${pathname === '/' ? '' : pathname}`;
  return NextResponse.redirect(url, 308);
}

export const config = {
  matcher: ['/((?!api|_next|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)'],
};
