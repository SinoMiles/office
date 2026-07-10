'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const faqs = [
  {
    question: "OfficeGPT 与传统 Excel/Word 相比有什么优势？",
    answer: "OfficeGPT 彻底颠覆了传统的软件操作模式。您不再需要死记硬背复杂的 Excel 函数（如 VLOOKUP）或费时费力地手动排版 Word。只需输入自然语言指令（例如：“将表格里的空值填充为0，并按销售额倒序排列”），底层的 AI 引擎会自动解析意图并瞬间完成计算与排版，极大降低了使用门槛并提升了工作效率。"
  },
  {
    question: "上传的文档数据安全吗？",
    answer: "绝对安全。OfficeGPT 采用金融级别的沙盒隔离环境运行所有文档处理任务。您的文件数据仅在处理期间驻留于加密内存中，任务完成后将立即从服务器销毁，并且我们承诺绝不会使用用户的隐私数据来训练模型。"
  },
  {
    question: "AI 是如何进行文档处理的？",
    answer: "OfficeGPT 底层搭载了专为结构化数据微调的深度学习模型，结合先进的抽象语法树（AST）与宏脚本动态生成技术。当您输入自然语言时，AI 会将其编译为精准的操作脚本，并在安全的容器环境中毫秒级执行，从而实现对各类 Office 文档的无损读取、计算、转换与生成。"
  },
  {
    question: "OfficeGPT 提供免费体验吗？",
    answer: "是的，我们为新注册用户提供慷慨的免费体验额度，足以让您完整体验诸如智能排版、AI 总结、文档翻译等核心功能。随着使用深度的增加，您可以选择订阅高级套餐以解锁不限量的高阶处理能力。"
  }
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState(0);

  // Generate JSON-LD for AI search engines
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
    }))
  };

  return (
    <section style={{ padding: '80px 24px', background: 'var(--background)' }}>
      {/* JSON-LD Schema Injection */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      
      <div className="container" style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <h2 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '16px' }}>常见问题解答</h2>
          <p style={{ fontSize: '1.1rem', color: 'var(--text-muted)' }}>
            了解更多关于 OfficeGPT 的核心优势与安全机制
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div 
                key={index} 
                style={{ 
                  background: 'white', 
                  borderRadius: '16px', 
                  border: '1px solid var(--border)',
                  overflow: 'hidden',
                  transition: 'all 0.3s ease'
                }}
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? -1 : index)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '24px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <span style={{ fontSize: '1.1rem', fontWeight: 600, color: isOpen ? 'var(--primary)' : 'var(--text-main)', transition: 'color 0.2s' }}>
                    {faq.question}
                  </span>
                  <ChevronDown 
                    style={{ 
                      color: isOpen ? 'var(--primary)' : 'var(--text-muted)',
                      transform: isOpen ? 'rotate(180deg)' : 'rotate(0)',
                      transition: 'transform 0.3s ease, color 0.2s'
                    }} 
                  />
                </button>
                <div 
                  style={{ 
                    maxHeight: isOpen ? '500px' : '0', 
                    opacity: isOpen ? 1 : 0,
                    overflow: 'hidden',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                >
                  <div style={{ padding: '0 24px 24px 24px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                    {faq.answer}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
