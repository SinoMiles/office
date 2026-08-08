import { headers } from 'next/headers';
import { normalizeLocale } from '@/app/i18n/config';

export async function generateMetadata() {
  const headerStore = await headers();
  const locale = normalizeLocale(headerStore.get('x-office-locale') || headerStore.get('accept-language'));
  return {
    title: locale === 'zh-CN' ? '登录 | OfficeGPT' : 'Sign in | OfficeGPT',
    robots: { index: false, follow: true },
  };
}

export default function LoginLayout({ children }) {
  return children;
}
