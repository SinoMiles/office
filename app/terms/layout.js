import { headers } from 'next/headers';
import { normalizeLocale } from '@/app/i18n/config';
import { chineseOnlyMetadata } from '@/app/i18n/publicSeo';

export async function generateMetadata() {
  const locale = normalizeLocale((await headers()).get('x-office-locale'));
  return chineseOnlyMetadata(
    locale,
    '/terms',
    '服务条款 | OfficeGPT',
    '阅读 OfficeGPT 的账户、AI 输出、用户内容、使用规范、Credits 计费与服务责任条款。',
  );
}

export default function TermsLayout({ children }) {
  return children;
}
