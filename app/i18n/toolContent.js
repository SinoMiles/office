import { toolSeoEn } from './toolSeoEn';

/**
 * 取某个工具在指定语言下的 SEO 正文。
 * 服务端(生成结构化数据)与客户端(渲染页面)共用这一个入口，
 * 避免出现「页面上有 FAQ、结构化数据里却是空的」这类不一致。
 *
 * 返回 null 表示该语种没有真实内容，调用方应退回通用模板且不要输出 FAQPage —
 * 给搜索引擎一份模板化的 FAQ 反而会被判定为重复内容。
 */
export function toolContent(tool, locale) {
  if (!tool) return null;
  if (locale === 'zh-CN') {
    return tool.seo ? { ...tool.seo, name: tool.name } : null;
  }
  if (locale === 'en') {
    const authored = toolSeoEn(tool.id);
    if (!authored) return null;
    // related 只维护一份（中文侧），英文复用同样的关联关系。
    return { ...authored, related: tool.seo?.related || [] };
  }
  return null;
}
