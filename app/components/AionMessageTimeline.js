'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Brain, CheckCircle2, ChevronDown, ChevronRight, Circle, Loader2, Terminal, XCircle } from 'lucide-react';

function stringifyDetail(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}

function ThinkingBlock({ block }) {
  const [expanded, setExpanded] = useState(false);
  const seconds = Math.max(0, Math.round(Number(block.duration || block.duration_ms || 0) / 1000));
  return (
    <div style={{ margin: '4px 0 10px' }}>
      <button type="button" onClick={() => setExpanded((value) => !value)} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '4px 0', border: 0, background: 'transparent', color: '#64748b', cursor: 'pointer', fontSize: '0.82rem' }}>
        {block.done ? <Brain size={14} /> : <Loader2 size={14} className="spin-anim" />}
        <span>{block.done ? '思考完成' : block.subject || '思考中'}{block.done && seconds ? ` · ${seconds} 秒` : ''}</span>
        <ChevronRight size={13} style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform .18s' }} />
      </button>
      {expanded && block.description && <div style={{ margin: '4px 0 2px 21px', padding: '9px 11px', borderLeft: '2px solid #e2e8f0', color: '#64748b', fontSize: '0.82rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{block.description}</div>}
    </div>
  );
}

function ToolRow({ step }) {
  const [expanded, setExpanded] = useState(false);
  const detail = stringifyDetail(step.input || step.output || step.detail);
  const StatusIcon = step.status === 'completed' ? CheckCircle2 : step.status === 'failed' ? XCircle : step.status === 'running' ? Loader2 : Circle;
  return (
    <div style={{ borderRadius: '9px', background: '#f8fafc', overflow: 'hidden' }}>
      <button type="button" onClick={() => detail && setExpanded((value) => !value)} style={{ width: '100%', minHeight: '42px', padding: '9px 11px', display: 'flex', alignItems: 'center', gap: '9px', border: 0, background: 'transparent', cursor: detail ? 'pointer' : 'default', color: '#64748b', textAlign: 'left' }}>
        <StatusIcon size={14} className={step.status === 'running' ? 'spin-anim' : ''} color={step.status === 'completed' ? '#16a34a' : step.status === 'failed' ? '#dc2626' : '#64748b'} />
        <Terminal size={14} />
        <span style={{ flex: 1, fontSize: '0.82rem' }}>{step.title || '执行工具'}</span>
        {detail && <ChevronRight size={14} style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform .18s' }} />}
      </button>
      {expanded && <pre style={{ margin: 0, padding: '10px 12px', maxHeight: '220px', overflow: 'auto', borderTop: '1px solid #e2e8f0', background: '#f1f5f9', color: '#475569', fontSize: '0.75rem', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{detail}</pre>}
    </div>
  );
}

function ToolGroup({ block }) {
  const [expanded, setExpanded] = useState(!block.done);
  return (
    <div style={{ margin: '5px 0 12px' }}>
      <button type="button" onClick={() => setExpanded((value) => !value)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 0', border: 0, background: 'transparent', color: '#64748b', cursor: 'pointer', fontSize: '0.82rem' }}>
        <span>View Steps · {block.steps.length}</span>
        <ChevronDown size={13} style={{ transform: expanded ? 'none' : 'rotate(-90deg)', transition: 'transform .18s' }} />
      </button>
      {expanded && <div style={{ display: 'grid', gap: '7px', marginTop: '7px' }}>{block.steps.map((step, index) => <ToolRow key={step.id || `${step.title}-${index}`} step={step} />)}</div>}
    </div>
  );
}

function TextBlock({ content, error }) {
  if (!content) return null;
  return (
    <div className="markdown-body" style={{ lineHeight: 1.6, color: error ? '#ef4444' : 'var(--text-main)' }}>
      {error ? <div style={{ whiteSpace: 'pre-wrap' }}>{content}</div> : <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>}
    </div>
  );
}

export default function AionMessageTimeline({ message }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {(message.blocks || []).map((block, index) => {
        if (block.type === 'thinking') return <ThinkingBlock key={`${block.id}-${index}`} block={block} />;
        if (block.type === 'tools') return <ToolGroup key={`${block.id}-${index}`} block={block} />;
        if (block.type === 'text') return <TextBlock key={`${block.id}-${index}`} content={block.content} error={message.error} />;
        return null;
      })}
      {message.loading && <div style={{ display: 'flex', alignItems: 'center', gap: '7px', color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '6px' }}><Loader2 size={14} className="spin-anim" /> 正在继续生成…</div>}
    </div>
  );
}
