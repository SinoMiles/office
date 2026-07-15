'use client';

import { useState } from 'react';
import { AlertCircle, Brain, CheckCircle2, ChevronDown, ChevronRight, Circle, ClipboardList, Info, Loader2 } from 'lucide-react';
import ChatMarkdown from '@/app/components/ChatMarkdown';

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

function PlanBlock({ block }) {
  const [expanded, setExpanded] = useState(true);
  return (
    <div style={{ margin: '6px 0 12px' }}>
      <button type="button" onClick={() => setExpanded((value) => !value)} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '4px 0', border: 0, background: 'transparent', color: '#64748b', cursor: 'pointer', fontSize: '0.84rem' }}><ClipboardList size={15} /><span>{block.title || '任务计划'}</span><ChevronDown size={13} style={{ transform: expanded ? 'none' : 'rotate(-90deg)' }} /></button>
      {expanded && <div style={{ display: 'grid', gap: '7px', margin: '7px 0 0 21px' }}>{block.entries.map((entry, index) => { const done = entry.status === 'completed' || entry.done; return <div key={entry.id || index} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', color: done ? '#64748b' : '#334155', fontSize: '0.82rem' }}>{done ? <CheckCircle2 size={15} color="#16a34a" /> : <Circle size={15} color="#94a3b8" />}<span style={{ textDecoration: done ? 'line-through' : 'none' }}>{entry.content || entry.title || entry.description}</span></div>; })}</div>}
    </div>
  );
}

function NoticeBlock({ block }) {
  const isError = block.level === 'error' || block.status === 'error';
  const Icon = isError ? AlertCircle : Info;
  if (!block.content) return null;
  return <div style={{ margin: '6px 0 12px', padding: '10px 12px', display: 'flex', gap: '8px', border: `1px solid ${isError ? '#fecaca' : '#dbeafe'}`, borderRadius: '10px', background: isError ? '#fff7f7' : '#f8fbff', color: isError ? '#b91c1c' : '#475569', fontSize: '0.82rem', lineHeight: 1.5 }}><Icon size={16} style={{ flexShrink: 0, marginTop: '2px' }} /><span>{block.content}</span></div>;
}

function TextBlock({ content, error }) {
  if (!content) return null;
  return <ChatMarkdown error={error}>{content}</ChatMarkdown>;
}

export default function AionMessageTimeline({ message }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {(message.blocks || []).map((block, index) => {
        if (block.type === 'thinking') return <ThinkingBlock key={`${block.id}-${index}`} block={block} />;
        if (block.type === 'tools') return null;
        if (block.type === 'plan') return <PlanBlock key={`${block.id}-${index}`} block={block} />;
        if (block.type === 'tip' || block.type === 'status') return <NoticeBlock key={`${block.id}-${index}`} block={block} />;
        if (block.type === 'text') return <TextBlock key={`${block.id}-${index}`} content={block.content} error={message.error} />;
        return null;
      })}
      {message.loading && <div style={{ display: 'flex', alignItems: 'center', gap: '7px', color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '6px' }}><Loader2 size={14} className="spin-anim" /> 正在继续生成…</div>}
    </div>
  );
}
