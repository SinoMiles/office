import { FileText, Image as ImageIcon, FileArchive, Scissors, Lock, FileSignature, Sparkles, MessageSquare, Bot, Zap, FileJson, Table } from 'lucide-react';

const seo = (summary, useCases, faqs, related = []) => ({ summary, useCases, faqs, related });

export const toolCategories = [
  {
    title: '格式极速转换',
    icon: <Zap size={20} color="#f59e0b" />,
    color: 'linear-gradient(135deg, #fef3c7, #fde68a)',
    tools: [
      { id: 'word-to-pdf', name: 'Word 转 PDF', desc: '高保真转换，保留原始排版', icon: <FileText size={24} color="#f59e0b" />, comingSoon: false, accept: '.doc,.docx', multiple: false, type: 'convert' },
      { id: 'excel-to-pdf', name: 'Excel 转 PDF', desc: '自动适配分页与打印区域', icon: <Table size={24} color="#10b981" />, comingSoon: false, accept: '.xls,.xlsx', multiple: false, type: 'convert' },
      { id: 'ppt-to-pdf', name: 'PPT 转 PDF', desc: '完美保留幻灯片矢量图形', icon: <FileArchive size={24} color="#f43f5e" />, comingSoon: false, accept: '.ppt,.pptx', multiple: false, type: 'convert' },
      { id: 'word-to-text', name: 'Word 提取文字', desc: '从 DOCX 导出干净的纯文本内容', icon: <FileText size={24} color="#2563eb" />, comingSoon: false, accept: '.docx', multiple: false, type: 'document-util', seo: seo('解析 DOCX 的正文、标题和表格文字并导出 TXT，不携带复杂格式，适合检索、迁移和内容分析。', ['旧 Word 内容迁移到新系统', '提取正文交给 AI 总结', '从复杂排版中获得干净文字'], [['是否支持旧版 DOC？', '当前支持 DOCX；旧版 DOC 可先使用 Word 转换。'], ['图片里的文字能提取吗？', '不能，图片文字需要 OCR。']], ['ai-summary', 'ai-polish']) },
      { id: 'word-to-jpg', name: 'Word 转 JPG 图片', desc: '将 Word 每一页批量渲染并打包下载', icon: <ImageIcon size={24} color="#2563eb" />, comingSoon: false, accept: '.doc,.docx', multiple: false, type: 'image-convert' },
      { id: 'word-images-extract', name: 'Word 图片批量提取', desc: '导出 DOCX 中内嵌的原始图片素材', icon: <ImageIcon size={24} color="#2563eb" />, comingSoon: false, accept: '.docx', multiple: false, type: 'document-util' },
      { id: 'ppt-to-text', name: 'PPT 提取文字', desc: '按幻灯片顺序导出标题和正文', icon: <FileText size={24} color="#ea580c" />, comingSoon: false, accept: '.pptx', multiple: false, type: 'document-util' },
      { id: 'ppt-notes-extract', name: 'PPT 备注提取', desc: '批量导出演讲者备注与讲稿', icon: <MessageSquare size={24} color="#ea580c" />, comingSoon: false, accept: '.pptx', multiple: false, type: 'document-util' },
      { id: 'ppt-images-extract', name: 'PPT 图片批量提取', desc: '导出 PPTX 中内嵌的原图素材', icon: <ImageIcon size={24} color="#ea580c" />, comingSoon: false, accept: '.pptx', multiple: false, type: 'document-util' },
      { id: 'ppt-to-jpg', name: 'PPT 转 JPG 图片', desc: '逐页渲染幻灯片并打包下载', icon: <ImageIcon size={24} color="#ea580c" />, comingSoon: false, accept: '.ppt,.pptx', multiple: false, type: 'image-convert' },
      { id: 'img-to-pdf', name: '多图拼合 PDF', desc: '将多张 JPG/PNG 合并为 PDF', icon: <ImageIcon size={24} color="#3b82f6" />, comingSoon: false, accept: '.jpg,.jpeg,.png', multiple: true, type: 'pdf-util' },
      { id: 'pdf-to-text', name: 'PDF 提取文字', desc: '从可搜索 PDF 中导出纯文本', icon: <FileText size={24} color="#3b82f6" />, comingSoon: false, accept: '.pdf', multiple: false, type: 'document-util', seo: seo('直接解析 PDF 的文本层并导出 TXT，适合后续检索、归档或交给 AI 分析。扫描版 PDF 请改用 OCR。', ['从报告中提取可复制文字', '把 PDF 内容导入知识库', '为 AI 总结准备干净文本'], [['扫描件能识别吗？', '本工具读取已有文本层；扫描件请使用 PDF OCR。'], ['会改变原 PDF 吗？', '不会，处理过程只读取文件。']], ['ai-summary', 'ai-pdf-chat']) },
      { id: 'pdf-clean-metadata', name: 'PDF 隐私信息清理', desc: '移除标题、作者和软件等元数据', icon: <Lock size={24} color="#3b82f6" />, comingSoon: false, accept: '.pdf', multiple: false, type: 'pdf-util', seo: seo('清除 PDF 属性中可能暴露作者、单位、制作软件和关键词的信息，再生成一份干净副本。', ['对外发送合同前清理作者信息', '匿名提交论文或方案', '公开资料前减少隐私暴露'], [['会删除正文吗？', '不会，只处理文档属性和元数据。'], ['能清除正文里的姓名吗？', '不能，正文脱敏需要 AI 脱敏工具。']], ['ai-redact', 'watermark']) },
      { id: 'pdf-page-numbers', name: 'PDF 批量添加页码', desc: '为整份 PDF 自动生成连续页码', icon: <FileSignature size={24} color="#3b82f6" />, comingSoon: false, accept: '.pdf', multiple: false, type: 'pdf-util', option: { name: 'startPage', label: '起始页码', placeholder: '例如：1' }, seo: seo('给多页 PDF 统一添加连续页码，适用于标书、合同附件和培训材料归档。', ['投标文件统一编号', '合同附件补充页码', '讲义打印前整理页序'], [['可以指定起始数字吗？', '可以，例如输入 5 会从第 5 页码开始。'], ['原文件会被覆盖吗？', '不会，会下载新文件。']], ['merge-pdf', 'split-pdf']) },
    ]
  },
  {
    title: '表格与数据转换',
    icon: <Table size={20} color="#10b981" />,
    color: 'linear-gradient(135deg, #d1fae5, #a7f3d0)',
    tools: [
      { id: 'excel-to-csv', name: 'Excel 转 CSV', desc: '提取首个工作表为通用 CSV', icon: <Table size={24} color="#10b981" />, comingSoon: false, accept: '.xls,.xlsx', multiple: false, type: 'document-util', seo: seo('把 Excel 首个工作表转换为 UTF-8 CSV，便于导入数据库、财务系统和数据分析工具。', ['系统只接受 CSV 上传', '将表格导入数据库', '跨软件交换结构化数据'], [['多个 Sheet 怎么处理？', '当前导出首个工作表，多个工作表可分别处理。'], ['中文会乱码吗？', '输出使用 UTF-8 编码。']], ['csv-to-excel', 'excel-to-json']) },
      { id: 'excel-to-json', name: 'Excel 转 JSON', desc: '把表格记录转换为结构化 JSON', icon: <FileJson size={24} color="#10b981" />, comingSoon: false, accept: '.xls,.xlsx', multiple: false, type: 'document-util', seo: seo('使用首行作为字段名，将 Excel 数据转换成开发和接口常用的 JSON 数组。', ['生成接口测试数据', '把运营表格交给开发', '将 Excel 导入应用程序'], [['公式会怎样处理？', '导出工作簿中保存的计算结果。'], ['空单元格是否保留？', '会按字段结构输出空值。']], ['json-to-excel', 'excel-to-csv']) },
      { id: 'csv-to-excel', name: 'CSV 转 Excel', desc: '将 CSV 转成可编辑 XLSX 工作簿', icon: <Table size={24} color="#10b981" />, comingSoon: false, accept: '.csv', multiple: false, type: 'document-util', seo: seo('将 CSV 数据封装为标准 XLSX，方便筛选、设置格式并继续制作报表。', ['下载数据后继续在 Excel 分析', '解决 CSV 展示不直观的问题', '把系统导出记录制成工作簿'], [['支持中文吗？', '支持 UTF-8 CSV。'], ['会自动添加样式吗？', '生成基础可编辑工作表，不擅自修改数据。']], ['excel-to-csv', 'ai-excel-analysis']) },
      { id: 'csv-to-json', name: 'CSV 转 JSON', desc: '将行列数据转换成 JSON 数组', icon: <FileJson size={24} color="#10b981" />, comingSoon: false, accept: '.csv', multiple: false, type: 'document-util', seo: seo('读取 CSV 表头与记录，输出便于接口、脚本和前端应用使用的 JSON。', ['快速制作 API 数据', '迁移 CSV 数据源', '检查字段和值的对应关系'], [['第一行必须是表头吗？', '是，第一行会作为 JSON 字段名。'], ['是否上传到第三方？', '不会，文件由本站服务器本地处理。']], ['json-to-csv', 'excel-to-json']) },
      { id: 'json-to-excel', name: 'JSON 转 Excel', desc: '将对象数组整理成 XLSX 表格', icon: <Table size={24} color="#10b981" />, comingSoon: false, accept: '.json', multiple: false, type: 'document-util', seo: seo('把 JSON 对象数组展开为 Excel 行列，方便业务人员查看和二次编辑。', ['接口响应转业务报表', '开发数据交付运营团队', 'JSON 记录快速可视化'], [['支持嵌套对象吗？', '基础字段会直接转换，复杂嵌套建议先使用 AI 数据整理。'], ['数据会被修改吗？', '不会主动改写字段和值。']], ['excel-to-json', 'json-to-csv']) },
      { id: 'json-to-csv', name: 'JSON 转 CSV', desc: '把 JSON 数组导出为通用 CSV', icon: <FileJson size={24} color="#10b981" />, comingSoon: false, accept: '.json', multiple: false, type: 'document-util', seo: seo('将结构一致的 JSON 对象数组转换为 UTF-8 CSV，适合批量导入其他系统。', ['接口数据导入 CRM', 'JSON 转数据库导入文件', '生成轻量数据交换文件'], [['JSON 格式有什么要求？', '根节点应为对象数组。'], ['嵌套数据如何处理？', '复杂对象建议先扁平化。']], ['csv-to-json', 'json-to-excel']) },
      { id: 'excel-dedupe', name: 'Excel 数据去重', desc: '按整行内容移除重复记录', icon: <Table size={24} color="#10b981" />, comingSoon: false, accept: '.xls,.xlsx', multiple: false, type: 'document-util', seo: seo('保留第一条记录并删除完全重复的数据行，适合名单、订单和客户资料初步清洗。', ['客户名单合并后去重', '订单导出数据清理', '活动报名信息整理'], [['表头会被删除吗？', '不会，首行字段会保留。'], ['可以按指定列去重吗？', '当前按整行去重，按列智能去重可进入 AI 数据清洗。']], ['excel-clean', 'ai-excel-analysis']) },
      { id: 'excel-clean', name: 'Excel 空行清理', desc: '删除全空记录并规范表格范围', icon: <Table size={24} color="#10b981" />, comingSoon: false, accept: '.xls,.xlsx', multiple: false, type: 'document-util', seo: seo('清除工作表里的全空行，保留有效数据与字段顺序，减少导入系统时的错误。', ['系统导入前清理表格', '压缩异常膨胀的工作表范围', '整理人工维护的名单'], [['会删除部分为空的行吗？', '不会，只删除所有单元格均为空的记录。'], ['格式是否保留？', '主要保留数据内容，复杂视觉格式可能简化。']], ['excel-dedupe', 'excel-to-csv']) },
      { id: 'excel-merge', name: 'Excel 文件合并', desc: '将多个同结构工作簿纵向合并', icon: <Table size={24} color="#10b981" />, comingSoon: false, accept: '.xls,.xlsx', multiple: true, type: 'document-util' },
      { id: 'excel-split-sheets', name: 'Excel 按 Sheet 拆分', desc: '每个工作表生成独立 XLSX 并打包', icon: <FileArchive size={24} color="#10b981" />, comingSoon: false, accept: '.xls,.xlsx', multiple: false, type: 'document-util' },
      { id: 'excel-dedupe-columns', name: 'Excel 按列去重', desc: '按一个或多个字段识别重复记录', icon: <Table size={24} color="#10b981" />, comingSoon: false, accept: '.xls,.xlsx', multiple: false, type: 'document-util', option: { name: 'columns', label: '去重列名', placeholder: '例如：手机号,邮箱' } },
      { id: 'excel-formula-audit', name: 'Excel 公式审计', desc: '导出所有公式位置、表达式和缓存值', icon: <FileJson size={24} color="#10b981" />, comingSoon: false, accept: '.xls,.xlsx', multiple: false, type: 'document-util' },
      { id: 'excel-workbook-summary', name: 'Excel 工作簿概览', desc: '统计 Sheet、行列规模和公式数量', icon: <FileJson size={24} color="#10b981" />, comingSoon: false, accept: '.xls,.xlsx', multiple: false, type: 'document-util' },
      { id: 'xls-to-xlsx', name: 'XLS 转 XLSX', desc: '将旧版 Excel 转为现代工作簿格式', icon: <Table size={24} color="#10b981" />, comingSoon: false, accept: '.xls', multiple: false, type: 'document-util' },
      { id: 'xlsx-to-xls', name: 'XLSX 转 XLS', desc: '为旧系统生成 Excel 97-2003 格式', icon: <Table size={24} color="#10b981" />, comingSoon: false, accept: '.xlsx', multiple: false, type: 'document-util' },
    ]
  },
  {
    title: 'PDF 实用工具箱',
    icon: <FileArchive size={20} color="#3b82f6" />,
    color: 'linear-gradient(135deg, #dbeafe, #bfdbfe)',
    tools: [
      { id: 'merge-pdf', name: '合并 PDF', desc: '将多个文件拼接成一份文档', icon: <FileArchive size={24} color="#3b82f6" />, comingSoon: false, accept: '.pdf', multiple: true, type: 'pdf-util' },
      { id: 'split-pdf', name: '拆分 PDF', desc: '按指定页码范围提取新 PDF', icon: <Scissors size={24} color="#3b82f6" />, comingSoon: false, accept: '.pdf', multiple: false, type: 'pdf-util', option: { name: 'pages', label: '提取页码', placeholder: '例如：1-3,5,8-10' } },
      { id: 'watermark', name: '添加水印', desc: '自定义文字防伪水印保护', icon: <FileSignature size={24} color="#3b82f6" />, comingSoon: false, accept: '.pdf', multiple: false, type: 'pdf-util', option: { name: 'watermark', label: '水印文字', placeholder: '请输入水印文字' } },
      { id: 'pdf-to-jpg', name: 'PDF 转 JPG 图片', desc: '将每一页批量导出为 JPG 并打包', icon: <ImageIcon size={24} color="#3b82f6" />, comingSoon: false, accept: '.pdf', multiple: false, type: 'image-convert' },
      { id: 'pdf-to-png', name: 'PDF 转 PNG 图片', desc: '逐页输出清晰的无损 PNG 图片', icon: <ImageIcon size={24} color="#3b82f6" />, comingSoon: false, accept: '.pdf', multiple: false, type: 'image-convert' },
      { id: 'encrypt', name: 'PDF 密码保护', desc: '安全加密仍在接入本地处理引擎', icon: <Lock size={24} color="#3b82f6" />, comingSoon: true, accept: '.pdf', multiple: false, type: 'pdf-util' },
    ]
  },
  {
    title: 'AI 智能文档处理 (Pro)',
    icon: <Sparkles size={20} color="#8b5cf6" />,
    color: 'linear-gradient(135deg, #ede9fe, #ddd6fe)',
    tools: [
      { id: 'ai-summary', name: '超长文档总结', desc: '秒级提炼百页研报核心', icon: <Bot size={24} color="#8b5cf6" />, comingSoon: false, type: 'ai' },
      { id: 'ai-translate', name: '沉浸式翻译', desc: '保留原文档排版的双语翻译', icon: <MessageSquare size={24} color="#8b5cf6" />, comingSoon: false, type: 'ai' },
      { id: 'ai-polish', name: '智能公文润色', desc: '自动纠正语病与商业化语气', icon: <Sparkles size={24} color="#8b5cf6" />, comingSoon: false, type: 'ai' },
      { id: 'ai-ocr', name: 'OCR 结构提取', desc: '发票简历自动提取到 Excel', icon: <FileJson size={24} color="#8b5cf6" />, comingSoon: false, type: 'ai' },
      { id: 'ai-pdf-chat', name: '与 PDF 对话', desc: '针对文档内容连续提问并定位答案', icon: <MessageSquare size={24} color="#8b5cf6" />, comingSoon: false, type: 'ai' },
      { id: 'ai-contract-review', name: 'AI 合同审查', desc: '识别风险条款、责任边界和缺失项', icon: <Bot size={24} color="#8b5cf6" />, comingSoon: false, type: 'ai' },
      { id: 'ai-document-compare', name: '文档差异对比', desc: '归纳两个版本的实质性变更', icon: <FileJson size={24} color="#8b5cf6" />, comingSoon: false, type: 'ai' },
      { id: 'ai-redact', name: '文档智能脱敏', desc: '识别姓名、电话、证件号等敏感信息', icon: <Lock size={24} color="#8b5cf6" />, comingSoon: false, type: 'ai' },
      { id: 'ai-meeting-minutes', name: '会议纪要生成器', desc: '整理议题、结论、负责人和待办', icon: <MessageSquare size={24} color="#8b5cf6" />, comingSoon: false, type: 'ai' },
      { id: 'ai-weekly-report', name: '周报生成器', desc: '把工作记录整理成清晰周报', icon: <FileText size={24} color="#8b5cf6" />, comingSoon: false, type: 'ai' },
      { id: 'ai-annual-review', name: '年度述职生成器', desc: '从成果数据生成述职报告与 PPT 大纲', icon: <Sparkles size={24} color="#8b5cf6" />, comingSoon: false, type: 'ai' },
      { id: 'ai-resume', name: '简历优化', desc: '强化岗位匹配、成果表达和关键词', icon: <FileText size={24} color="#8b5cf6" />, comingSoon: false, type: 'ai' },
      { id: 'ai-excel-analysis', name: 'Excel 数据分析', desc: '自动发现趋势、异常并生成图表建议', icon: <Table size={24} color="#8b5cf6" />, comingSoon: false, type: 'ai' },
      { id: 'ai-ppt-outline', name: 'PPT 大纲生成器', desc: '按目标受众规划完整演示结构', icon: <FileArchive size={24} color="#8b5cf6" />, comingSoon: false, type: 'ai' },
      { id: 'ai-official-document', name: '公文格式与措辞检查', desc: '检查结构、语气、格式和常见错误', icon: <FileText size={24} color="#8b5cf6" />, comingSoon: false, type: 'ai' },
    ]
  }
];

for (const category of toolCategories) {
  for (const tool of category.tools) {
    if (tool.seo) continue;
    const aiTool = tool.type === 'ai';
    tool.seo = seo(
      aiTool
        ? `${tool.name}通过现有 Office AI 会话理解你的文件与指令，重点完成“${tool.desc}”。结果可以继续追问、修改，并在需要时生成正式 Office 文件。`
        : `${tool.name}用于完成“${tool.desc}”。基础处理在本站服务器内执行，生成新文件供下载，不会覆盖原始文件；完成后还可以交给 Office AI 继续分析或编辑。`,
      aiTool
        ? [`需要${tool.desc}但不想手工整理`, `希望围绕${tool.name}连续补充要求`, '需要把分析结果继续生成正式 Office 文件']
        : [`临时需要${tool.desc}`, '不想安装桌面软件的快速处理', '处理后继续交给 AI 总结、翻译或生成文档'],
      [
        [`${tool.name}是否免费？`, '当前工具可以免费开始使用；涉及 AI 深度处理时会按账户现有规则执行。'],
        [`使用${tool.name}会修改原文件吗？`, aiTool ? '不会直接覆盖上传文件，生成结果会作为新的任务产物保存。' : '不会，系统会生成新的处理结果供你下载。'],
      ],
      aiTool ? ['ai-summary', 'ai-polish'] : ['ai-summary', 'ai-pdf-chat'],
    );
  }
}

export function getToolById(id) {
  for (const category of toolCategories) {
    const found = category.tools.find(t => t.id === id);
    if (found) return found;
  }
  return null;
}

export function getAllTools() {
  return toolCategories.flatMap((category) => category.tools);
}
