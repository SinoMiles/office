import { SUPPORTED_LOCALES } from './config';

export const localeSegments = { 'zh-CN': 'zh-cn', en: 'en' };

export function localizedPath(locale, pathname = '/') {
  const suffix = pathname === '/' ? '' : pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `/${localeSegments[locale] || 'zh-cn'}${suffix}`;
}

export function languageAlternates(pathname = '/') {
  const languages = Object.fromEntries(SUPPORTED_LOCALES.map(({ code }) => [code, localizedPath(code, pathname)]));
  languages['x-default'] = localizedPath('zh-CN', pathname);
  return languages;
}

const seo = {
  'zh-CN':['OfficeGPT - 全能 AI 智能办公套件与文档处理大厅','使用自然语言处理 Excel、PPT、Word 和 PDF，完成文档转换、分析、整理与生成。'],
  en:['OfficeGPT - AI Office Suite and Document Tools','Process Excel, PPT, Word, and PDF with natural language for conversion, analysis, formatting, and generation.'],
  ja:['OfficeGPT - AI オフィススイートと文書ツール','自然な言葉で Excel、PPT、Word、PDF の変換、分析、整理、生成を行えます。'],
  ko:['OfficeGPT - AI 오피스 제품군 및 문서 도구','자연어로 Excel, PPT, Word, PDF를 변환, 분석, 정리하고 생성하세요.'],
  es:['OfficeGPT - Suite de oficina con IA y herramientas documentales','Procesa Excel, PPT, Word y PDF con lenguaje natural para convertir, analizar, organizar y crear.'],
  pt:['OfficeGPT - Suíte de escritório com IA e ferramentas de documentos','Processe Excel, PPT, Word e PDF com linguagem natural para converter, analisar, organizar e criar.'],
  fr:['OfficeGPT - Suite bureautique IA et outils documentaires','Traitez Excel, PPT, Word et PDF en langage naturel pour convertir, analyser, organiser et créer.'],
  de:['OfficeGPT - KI-Office-Suite und Dokumentwerkzeuge','Verarbeiten Sie Excel, PPT, Word und PDF per natürlicher Sprache zum Konvertieren, Analysieren und Erstellen.'],
};

export function publicMetadata(locale, pathname = '/') {
  const [title, description] = seo[locale] || seo['zh-CN'];
  const canonical = localizedPath(locale, pathname);
  return {
    title,
    description,
    alternates: { canonical, languages: languageAlternates(pathname) },
    openGraph: { title, description, url: canonical, locale: locale.replace('-', '_'), type: 'website', siteName: 'OfficeGPT' },
    // 图片由 opengraph-image.js 动态生成，Next 会自动注入到 og:image 与
    // twitter:image，这里只需要声明卡片类型。
    twitter: { card: 'summary_large_image', title, description },
  };
}
