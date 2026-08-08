import { headers } from 'next/headers';
import { normalizeLocale } from '@/app/i18n/config';
import { chineseOnlyMetadata } from '@/app/i18n/publicSeo';

export async function generateMetadata() {
  const locale = normalizeLocale((await headers()).get('x-office-locale'));
  return chineseOnlyMetadata(
    locale,
    '/privacy',
    '隐私政策 | OfficeGPT',
    '了解 OfficeGPT 如何收集、使用、保存和保护账户、文档、任务与交易相关信息。',
  );
}

export default function PrivacyLayout({ children }) {
  return children;
}
