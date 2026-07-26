// 只保留实际投放的两个语种。此前这里还躺着 ja/ko/es/pt/fr/de 六份文案，
// 但 SUPPORTED_LOCALES 收缩后它们已经不可达（normalizeLocale 会把它们归到 en），
// 留着只会让人误以为多语言仍在生效。
export const homeCopy = {
  'zh-CN': {
    badge: '已上线 50 个文档工具 · 无需注册即可使用',
    hero: [
      '与你的数据',
      '直接对话',
      '无需记忆函数或翻找菜单，只需用自然语言描述目标，OfficeGPT 即可完成复杂运算、整理与排版。',
      '免费开始使用',
    ],
    heroSecondary: '浏览全部工具',
    stats: [
      ['50', '文档处理工具'],
      ['4', '能力大类'],
      ['0 元', '确定性工具永久免费'],
      ['即时', '处理完成后删除文件'],
    ],
    catalog: ['能力总览', '不只是聊天，更是一整套文档工具箱', '格式转换、表格清洗、PDF 处理开箱即用；需要判断力的活儿再交给 AI。'],
    catalogCta: '查看全部 50 个工具',
    categories: [
      ['格式极速转换', 'Word、Excel、PPT 与 PDF 之间高保真互转，保留原始排版。', ['Word 转 PDF', 'PPT 转 JPG', 'PDF 提取文字']],
      ['表格与数据', '去重、清洗、合并、拆分与公式审计，导入系统前先把数据理干净。', ['Excel 去重', 'CSV 转 Excel', '公式审计']],
      ['PDF 工具箱', '合并拆分、加水印、添页码、AES-256 加密，一套流程走完。', ['合并 PDF', '添加水印', '密码保护']],
      ['AI 智能处理', '合同审查、公文检查、会议纪要、述职报告 —— 中文职场的真实场景。', ['合同审查', '公文检查', '周报生成']],
    ],
    workflow: ['工作流革命', '像聊天一样，搞定繁琐数据', '将你的意图直接转化为准确的文档结果。'],
    steps: [
      ['上传任意办公文件', '上传 Excel、Word 或 PPT，隔离环境会安全解析文档结构。'],
      ['输入自然语言指令', '直接告诉 AI 要清洗、计算、整理或生成什么内容。'],
      ['实时获得完整结果', '复杂操作自动执行，处理后的文档会直接显示并可下载。'],
    ],
    pricingTeaser: [
      '定价',
      '确定性工具免费，AI 按真实用量结算',
      '35 个转换与处理工具永久免费且无需注册。AI 能力按模型实际返回的 Token 用量计费，会员另享折扣与每月赠送额度。',
      '查看完整定价',
    ],
  },
  en: {
    badge: '50 document tools live · no account required',
    hero: [
      'Talk directly',
      'to your data',
      'No formulas or complex menus. Describe your goal in natural language and OfficeGPT handles calculations, organization, and formatting.',
      'Start for free',
    ],
    heroSecondary: 'Browse all tools',
    stats: [
      ['50', 'document tools'],
      ['4', 'capability areas'],
      ['Free', 'deterministic tools, forever'],
      ['Instant', 'files deleted after processing'],
    ],
    catalog: ['What you get', 'More than a chatbot — a complete document toolbox', 'Conversion, spreadsheet cleanup and PDF utilities work out of the box. Hand the judgement calls to AI.'],
    catalogCta: 'See all 50 tools',
    categories: [
      ['Fast conversion', 'High-fidelity conversion between Word, Excel, PowerPoint and PDF with layout preserved.', ['Word to PDF', 'PPT to JPG', 'Extract PDF text']],
      ['Spreadsheets & data', 'Deduplicate, clean, merge, split and audit formulas before anything reaches your systems.', ['Remove duplicates', 'CSV to Excel', 'Formula audit']],
      ['PDF toolbox', 'Merge, split, watermark, paginate and lock with AES-256 — the whole pipeline in one place.', ['Merge PDF', 'Add watermark', 'Password protect']],
      ['AI processing', 'Contract review, meeting minutes, weekly reports and résumé work on real documents.', ['Contract review', 'Meeting minutes', 'Weekly report']],
    ],
    workflow: ['A new workflow', 'Handle complex data like a conversation', 'Turn your intent directly into accurate document results.'],
    steps: [
      ['Upload any office file', 'Upload Excel, Word, or PPT files for secure parsing in an isolated environment.'],
      ['Give natural-language instructions', 'Tell AI exactly what to clean, calculate, organize, or create.'],
      ['Get complete results instantly', 'Complex operations run automatically and finished files are ready to view and download.'],
    ],
    pricingTeaser: [
      'Pricing',
      'Deterministic tools are free; AI bills on real usage',
      '35 conversion and processing tools are free forever and need no account. AI features are settled against the tokens the model actually reports, with member discounts and a monthly credit grant on top.',
      'See full pricing',
    ],
  },
};
