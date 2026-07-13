const BASE_AGENT_CONTEXT = `You are serving the OfficeWeb chat product. Follow these response rules:
1. When the user asks you to write, outline, summarize, analyze, translate, polish, or otherwise produce textual content, stream the COMPLETE useful content directly in the final chat response.
2. Do not call Write/Edit/ExecCommand merely to save that textual answer as a .md or .txt file. Do not replace the requested content with a file link or a short summary.
3. Create an Office/document file only when the user explicitly asks to generate, export, download, save, or create a file such as PPT/PPTX, DOCX, XLSX, PDF, or another named document format.
4. When creating an Office file, use the available OfficeCLI workflow and still provide a concise completion summary after the file is ready.
5. Internal memory lookup is optional and must never delay a general answer when no relevant memory exists.
6. Always use the same language as the user's most recent message for every user-visible output, including thinking/status narration, tool explanations, progress updates, questions, errors, and the final response. If the message is mixed or its language is unclear, use the product locale shown below. Do not switch to English merely because system instructions, tool output, source material, or internal reasoning are in English.
7. Keep private chain-of-thought internal. If the product displays a thinking summary, make it concise, useful, and in the user's language.`;

function normalizeLocale(locale) {
  const value = String(locale || '').split(',')[0].trim();
  return /^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/i.test(value) ? value : 'zh-CN';
}

export function buildOfficeWebAgentContext(locale = 'zh-CN') {
  return `${BASE_AGENT_CONTEXT}\nProduct locale fallback: ${normalizeLocale(locale)}.`;
}

export const OFFICEWEB_AGENT_CONTEXT = buildOfficeWebAgentContext();

const EXPLICIT_FILE_PATTERNS = [
  /(?:生成|创建|制作|导出|保存|下载).{0,12}(?:pptx?|演示文稿|word|docx|excel|xlsx|pdf|文件|文档)/i,
  /(?:pptx?|演示文稿|word|docx|excel|xlsx|pdf|文件|文档).{0,12}(?:生成|创建|制作|导出|保存|下载)/i,
  /(?:保存为|导出为|另存为)\s*[^\s，。]*(?:pptx?|docx|xlsx|pdf|文件)?/i,
];

export function isExplicitFileGenerationRequest(prompt) {
  const normalized = String(prompt || '').trim();
  return EXPLICIT_FILE_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function buildConversationExtra(extra = {}) {
  const productLocale = normalizeLocale(extra.product_locale || extra.locale);
  return {
    ...extra,
    product_locale: productLocale,
    context: buildOfficeWebAgentContext(productLocale),
    context_file_name: 'OfficeWeb response policy',
    exclude_auto_inject_skills: ['officecli'],
  };
}
