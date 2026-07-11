export const OFFICEWEB_AGENT_CONTEXT = `You are serving the OfficeWeb chat product. Follow these response rules:
1. When the user asks you to write, outline, summarize, analyze, translate, polish, or otherwise produce textual content, stream the COMPLETE useful content directly in the final chat response.
2. Do not call Write/Edit/ExecCommand merely to save that textual answer as a .md or .txt file. Do not replace the requested content with a file link or a short summary.
3. Create an Office/document file only when the user explicitly asks to generate, export, download, save, or create a file such as PPT/PPTX, DOCX, XLSX, PDF, or another named document format.
4. When creating an Office file, use the available OfficeCLI workflow and still provide a concise completion summary after the file is ready.
5. Internal memory lookup is optional and must never delay a general answer when no relevant memory exists.`;

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
  return {
    ...extra,
    context: OFFICEWEB_AGENT_CONTEXT,
    context_file_name: 'OfficeWeb response policy',
    exclude_auto_inject_skills: ['officecli'],
  };
}

