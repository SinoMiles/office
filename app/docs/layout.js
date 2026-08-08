import DocsLayoutClient from './DocsLayoutClient';
import { headers } from 'next/headers';
import { normalizeLocale } from '@/app/i18n/config';
import { chineseOnlyMetadata } from '@/app/i18n/publicSeo';

export async function generateMetadata() {
  const locale = normalizeLocale((await headers()).get('x-office-locale'));
  return chineseOnlyMetadata(
    locale,
    '/docs',
    'OfficeGPT 帮助文档与使用指南',
    '查阅 OfficeGPT 的入门说明、文档处理方法、账户与常见问题指南。',
  );
}

export default function DocsLayout({ children }) {
  return <DocsLayoutClient>{children}</DocsLayoutClient>;
}
