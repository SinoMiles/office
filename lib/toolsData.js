import { FileText, Image as ImageIcon, FileArchive, Scissors, Lock, FileSignature, Sparkles, MessageSquare, Bot, Zap, FileJson, Table } from 'lucide-react';

export const toolCategories = [
  {
    title: '格式极速转换',
    icon: <Zap size={20} color="#f59e0b" />,
    color: 'linear-gradient(135deg, #fef3c7, #fde68a)',
    tools: [
      { id: 'word-to-pdf', name: 'Word 转 PDF', desc: '高保真转换，保留原始排版', icon: <FileText size={24} color="#f59e0b" />, comingSoon: false, accept: '.doc,.docx', multiple: false, type: 'convert' },
      { id: 'excel-to-pdf', name: 'Excel 转 PDF', desc: '自动适配分页与打印区域', icon: <Table size={24} color="#10b981" />, comingSoon: false, accept: '.xls,.xlsx', multiple: false, type: 'convert' },
      { id: 'ppt-to-pdf', name: 'PPT 转 PDF', desc: '完美保留幻灯片矢量图形', icon: <FileArchive size={24} color="#f43f5e" />, comingSoon: false, accept: '.ppt,.pptx', multiple: false, type: 'convert' },
      { id: 'img-to-pdf', name: '多图拼合 PDF', desc: '将多张 JPG/PNG 合并为 PDF', icon: <ImageIcon size={24} color="#3b82f6" />, comingSoon: false, accept: '.jpg,.jpeg,.png', multiple: true, type: 'pdf-util' },
    ]
  },
  {
    title: 'PDF 实用工具箱',
    icon: <FileArchive size={20} color="#3b82f6" />,
    color: 'linear-gradient(135deg, #dbeafe, #bfdbfe)',
    tools: [
      { id: 'merge-pdf', name: '合并 PDF', desc: '将多个文件拼接成一份文档', icon: <FileArchive size={24} color="#3b82f6" />, comingSoon: false, accept: '.pdf', multiple: true, type: 'pdf-util' },
      { id: 'split-pdf', name: '拆分 PDF', desc: '提取前 5 页进行测试', icon: <Scissors size={24} color="#3b82f6" />, comingSoon: false, accept: '.pdf', multiple: false, type: 'pdf-util' },
      { id: 'watermark', name: '添加水印', desc: '文字防伪水印保护', icon: <FileSignature size={24} color="#3b82f6" />, comingSoon: false, accept: '.pdf', multiple: false, type: 'pdf-util' },
      { id: 'encrypt', name: '文档加解密', desc: '设置固定密码123加密文件', icon: <Lock size={24} color="#3b82f6" />, comingSoon: false, accept: '.pdf', multiple: false, type: 'pdf-util' },
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
    ]
  }
];

export function getToolById(id) {
  for (const category of toolCategories) {
    const found = category.tools.find(t => t.id === id);
    if (found) return found;
  }
  return null;
}
