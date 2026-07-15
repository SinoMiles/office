'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

const components = {
  code({ inline, className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || '');
    const codeText = String(children).replace(/\n$/, '');
    if (!inline && match) {
      return <div className="chat-markdown-code"><div className="chat-markdown-code-label">{match[1]}</div><SyntaxHighlighter {...props} style={oneLight} language={match[1]} PreTag="div" customStyle={{ margin: 0, padding: '16px', fontSize: '0.82rem', lineHeight: 1.65, background: '#f8fafc' }}>{codeText}</SyntaxHighlighter></div>;
    }
    return <code {...props} className={className}>{children}</code>;
  },
  table: ({ children, ...props }) => <div className="chat-markdown-table-wrap"><table {...props}>{children}</table></div>,
  a: ({ children, ...props }) => <a {...props} target="_blank" rel="noreferrer">{children}</a>,
};

export default function ChatMarkdown({ children, error = false }) {
  if (!children) return null;
  if (error) return <div className="chat-markdown chat-markdown-error" style={{ whiteSpace: 'pre-wrap' }}>{children}</div>;
  return <div className="chat-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{children}</ReactMarkdown></div>;
}
