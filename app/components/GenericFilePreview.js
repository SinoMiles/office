'use client';

import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Loader2 } from 'lucide-react';

export default function GenericFilePreview({ artifact }) {
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const textLike = ['markdown', 'text'].includes(artifact.previewType);
  useEffect(() => {
    if (!textLike) return;
    const controller = new AbortController();
    fetch(artifact.previewUrl, { signal: controller.signal }).then((response) => { if (!response.ok) throw new Error('文件读取失败'); return response.text(); }).then(setContent).catch((loadError) => { if (loadError.name !== 'AbortError') setError(loadError.message); });
    return () => controller.abort();
  }, [artifact.previewUrl, textLike]);
  if (!textLike) return <iframe key={artifact.previewUrl} src={artifact.previewUrl} title={artifact.filename} sandbox={artifact.previewType === 'html' ? 'allow-scripts' : undefined} style={{ width: '100%', height: '100%', minHeight: '560px', border: 0, background: 'white' }} />;
  if (error) return <div style={{ padding: '32px', color: '#b91c1c' }}>{error}</div>;
  if (!content) return <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: 'var(--text-muted)' }}><Loader2 size={18} className="spin-anim" /></div>;
  return <div style={{ height: '100%', overflow: 'auto', padding: '24px' }}>{artifact.previewType === 'markdown' ? <div className="markdown-body"><ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown></div> : <pre style={{ margin: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', font: '13px/1.65 ui-monospace, SFMono-Regular, Menlo, monospace' }}>{content}</pre>}</div>;
}
