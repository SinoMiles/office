import ToolsShell from './ToolsShell';
import { headers } from 'next/headers';
import { normalizeLocale } from '@/app/i18n/config';
import { publicMetadata } from '@/app/i18n/publicSeo';

const copy = {
  'zh-CN':['全能文档处理大厅 | OfficeGPT','安全、快速地转换和处理 PDF、Word、Excel、PPT，并使用 AI 完成复杂文档任务。'],
  en:['Online Document Tools | OfficeGPT','Convert and process PDF, Word, Excel, and PPT securely, then use AI for complex document tasks.'],
  ja:['オンライン文書ツール | OfficeGPT','PDF、Word、Excel、PPT を安全かつ高速に変換し、AI で複雑な文書作業を行えます。'],
  ko:['온라인 문서 도구 | OfficeGPT','PDF, Word, Excel, PPT를 안전하고 빠르게 변환하고 AI로 복잡한 문서 작업을 처리하세요.'],
  es:['Herramientas de documentos en línea | OfficeGPT','Convierte PDF, Word, Excel y PPT de forma segura y usa IA para tareas documentales complejas.'],
  pt:['Ferramentas de documentos online | OfficeGPT','Converta PDF, Word, Excel e PPT com segurança e use IA em tarefas documentais complexas.'],
  fr:['Outils documentaires en ligne | OfficeGPT','Convertissez PDF, Word, Excel et PPT en toute sécurité et utilisez l’IA pour les tâches complexes.'],
  de:['Online-Dokumentwerkzeuge | OfficeGPT','Konvertieren Sie PDF, Word, Excel und PPT sicher und nutzen Sie KI für komplexe Dokumentaufgaben.'],
};

export async function generateMetadata() {
  const locale = normalizeLocale((await headers()).get('x-office-locale'));
  const [title, description] = copy[locale] || copy['zh-CN'];
  return { ...publicMetadata(locale, '/tools'), title, description, openGraph: { ...publicMetadata(locale, '/tools').openGraph, title, description } };
}

export default function ToolsLayout({ children }) {
  return <ToolsShell>{children}</ToolsShell>;
}
