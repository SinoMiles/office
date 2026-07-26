import { NextResponse } from 'next/server';
import { LOCALE_COOKIE, LOCALE_EXPLICIT_COOKIE, RETIRED_LOCALE_SEGMENTS, normalizeLocale } from '@/app/i18n/config';

const localeSegments = { 'zh-CN': 'zh-cn', en: 'en' };
const segmentLocales = Object.fromEntries(Object.entries(localeSegments).map(([locale, segment]) => [segment, locale]));
const retiredSegments = new Set(RETIRED_LOCALE_SEGMENTS);
const publicRoots = new Set(['', 'tools', 'pricing', 'about', 'docs', 'privacy', 'terms', 'login', 'register', 'forgot-password']);

export function proxy(request) {
  const { pathname } = request.nextUrl;
  const parts = pathname.split('/').filter(Boolean);
  const firstSegment = parts[0]?.toLowerCase();

  // 已下线的语种用 301 永久重定向到英文版，把历史外链与已收录页面的权重合并过去，
  // 而不是留下 404 或继续提供重复内容。
  if (retiredSegments.has(firstSegment)) {
    const url = request.nextUrl.clone();
    url.pathname = `/en${parts.length > 1 ? `/${parts.slice(1).join('/')}` : ''}`;
    return NextResponse.redirect(url, 301);
  }

  const routeLocale = segmentLocales[firstSegment];
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
  // opengraph-image / twitter-image 是 Next 的元数据路由，社交平台爬虫会直接抓取
  // 元信息里那个不带语言前缀的地址。放行它们，避免多一次 308 跳转 ——
  // 部分爬虫对重定向的处理并不宽容。
  matcher: ['/((?!api|_next|favicon.ico|robots.txt|sitemap.xml|llms.txt|.*opengraph-image|.*twitter-image|.*\\..*).*)'],
};
