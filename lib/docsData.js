export const docsData = [
  {
    category: "新手入门",
    items: [
      {
        slug: "what-is-officegpt",
        title: "什么是 OfficeGPT？",
        content: `
# 什么是 OfficeGPT？

**OfficeGPT** 是全球首个专为 AI 智能体设计的现代文档处理办公套件，由**深圳市星尚硕教育科技有限公司**倾力打造。

## 传统痛点 vs AI 驱动
传统的办公软件要求用户记忆复杂的菜单、学习 VLOOKUP 等公式，并手动拖拽排版。而 OfficeGPT 将这些全部简化为**一句话**。

无论您是要：
- 批量处理 Excel 报表
- 将乱码的文本转换为精美的 Word
- 一键生成汇报 PPT

只需输入自然语言，底层的大型语言模型 (LLM) 将直接解析意图，并在安全的沙盒环境中极速执行任务。

## 数据安全性
我们深知企业数据安全的重要性。OfficeGPT 使用沙盒隔离技术执行计算，数据流只在处理过程中驻留加密内存，计算结束立即销毁，**绝不用于模型训练**。
        `
      },
      {
        slug: "quick-start",
        title: "快速开始体验",
        content: `
# 快速开始

只需三步，即可体验无代码的极速办公：

### 1. 选择工具
进入 **[全能文档处理大厅](/tools)**，根据您的需求选择对应的工具类别（如格式转换、智能排版）。

### 2. 上传文件
在安全的工作区中拖入您的文档（支持 .xlsx, .docx, .pptx, .pdf 等）。

### 3. 输入自然语言指令
例如在处理表格时，直接输入：
> "请提取 A 列所有人的手机号，如果为空则填充为'未知'，最后生成一张柱状图。"

按下发送，您的专属 AI Agent 会在毫秒内完成所有复杂操作。
        `
      }
    ]
  },
  {
    category: "核心教程",
    items: [
      {
        slug: "ai-formatting",
        title: "使用自然语言自动排版",
        content: `
# 使用自然语言自动排版

使用 OfficeGPT 的 Word 智能排版功能，您可以摆脱繁琐的样式调整。

## 支持的指令示例
- "将这篇文档调整为正式公文格式：标题使用二号黑体加粗居中，正文使用三号仿宋，行距固定值28磅。"
- "提取文中所有的重点结论，在文末生成一个带项目符号的【摘要】区块。"
- "将英文部分的语气修改为正式的商务邮件风格。"

AI 引擎会自动解析您的排版意图，通过抽象语法树 (AST) 重构您的 Word 文档，确保格式的绝对精准。
        `
      },
      {
        slug: "security-whitepaper",
        title: "数据安全与隐私白皮书",
        content: `
# 数据安全与隐私白皮书

本白皮书旨在向企业用户说明 **OfficeGPT** 的数据处理机制。

## 1. 物理环境隔离
所有用户数据上传后，直接进入专属的临时 Docker 沙盒环境。该环境切断了外部网络通信，防止任何形式的数据外传。

## 2. 无痕计算 (Zero Trace)
处理完成并供用户下载后，沙盒实例即刻销毁，服务器不保留任何原文件及计算后的成品文件。

## 3. 免于训练承诺
我们向所有用户承诺，**绝不**将您的业务文档用于任何公共或商业大模型的二次训练。
        `
      }
    ]
  }
];

export function getDocBySlug(slug) {
  for (const category of docsData) {
    for (const item of category.items) {
      if (item.slug === slug) return item;
    }
  }
  return null;
}

export function getAllDocs() {
  return docsData.flatMap((category) => category.items);
}
