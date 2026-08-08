import { headers } from 'next/headers';
import { normalizeLocale } from '@/app/i18n/config';
import { chineseOnlyMetadata } from '@/app/i18n/publicSeo';

export async function generateMetadata() {
  const locale = normalizeLocale((await headers()).get('x-office-locale'));
  return chineseOnlyMetadata(
    locale,
    '/about',
    '关于 OfficeGPT - 公司与产品介绍',
    '了解 OfficeGPT 与深圳市星尚硕教育科技有限公司，以及我们通过 AI 提升办公与文档处理效率的使命。',
  );
}

export default function AboutLayout({ children }) {
  return children;
}
