import { redirect } from 'next/navigation';

export default function DocsIndex() {
  // 默认重定向到第一篇文档
  redirect('/docs/what-is-officegpt');
}
