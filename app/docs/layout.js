import DocsLayoutClient from './DocsLayoutClient';

export const metadata = {
  title: '帮助文档中心 | OfficeGPT',
  description: '阅读 OfficeGPT 的详细使用教程、产品白皮书和技术解答，全面掌握 AI 智能办公的核心技巧。',
  keywords: ['帮助文档', '教程', 'OfficeGPT 使用手册', '白皮书', '数据安全'],
}

export default function DocsLayout({ children }) {
  return <DocsLayoutClient>{children}</DocsLayoutClient>;
}
