'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { File, FileImage, FileSpreadsheet, FileText, FolderOpen, Loader2, Pencil, Presentation, RefreshCw, Search, Trash2, Upload } from 'lucide-react';

function FileIcon({ type }) {
  if (type === 'ppt') return <Presentation size={17} color="#ea580c" />;
  if (type === 'excel') return <FileSpreadsheet size={17} color="#16a34a" />;
  if (type === 'image') return <FileImage size={17} color="#7c3aed" />;
  if (['word', 'markdown', 'text', 'pdf'].includes(type)) return <FileText size={17} color="#2563eb" />;
  return <File size={17} color="#64748b" />;
}

export default function WorkspaceBrowser({ taskId, onOpen }) {
  const [files, setFiles] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!taskId) return;
    setLoading(true); setError('');
    try {
      const response = await fetch(`/api/tasks/${taskId}/workspace`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || '工作区读取失败');
      setFiles(payload.files || []);
    } catch (loadError) { setError(loadError.message); }
    finally { setLoading(false); }
  }, [taskId]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  const visible = useMemo(() => { const keyword = query.trim().toLowerCase(); return keyword ? files.filter((file) => file.path.toLowerCase().includes(keyword)) : files; }, [files, query]);
  const groups = useMemo(() => { const result = new Map(); for (const file of visible) { const parts = file.path.split('/'); parts.pop(); const directory = parts.join('/') || '根目录'; if (!result.has(directory)) result.set(directory, []); result.get(directory).push(file); } return [...result.entries()]; }, [visible]);
  const uploadFile = useCallback(async (event) => { const file = event.target.files?.[0]; event.target.value = ''; if (!file) return; const form = new FormData(); form.append('file', file); const response = await fetch(`/api/tasks/${taskId}/workspace`, { method: 'POST', body: form }); const payload = await response.json(); if (!response.ok) setError(payload.error || '上传失败'); else void load(); }, [load, taskId]);
  const renameFile = useCallback(async (file) => { const nextName = window.prompt('输入新的文件名', file.name); if (!nextName || nextName === file.name) return; const response = await fetch(`/api/tasks/${taskId}/workspace`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filePath: file.path, newName: nextName }) }); const payload = await response.json(); if (!response.ok) setError(payload.error || '重命名失败'); else void load(); }, [load, taskId]);
  const deleteFile = useCallback(async (file) => { if (!window.confirm(`确定删除“${file.name}”吗？`)) return; const response = await fetch(`/api/tasks/${taskId}/workspace?path=${encodeURIComponent(file.path)}`, { method: 'DELETE' }); const payload = await response.json(); if (!response.ok) setError(payload.error || '删除失败'); else void load(); }, [load, taskId]);
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ padding: '12px', display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)' }}>
        <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '7px', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '9px', background: 'white' }}><Search size={15} color="#94a3b8" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索工作区文件" style={{ width: '100%', border: 0, outline: 0, background: 'transparent', fontSize: '0.84rem' }} /></label>
        <label title="上传文件" style={{ width: '36px', display: 'grid', placeItems: 'center', border: '1px solid var(--border)', borderRadius: '9px', background: 'white', cursor: 'pointer' }}><Upload size={15} /><input type="file" onChange={uploadFile} style={{ display: 'none' }} /></label><button type="button" onClick={() => void load()} title="刷新文件" style={{ width: '36px', border: '1px solid var(--border)', borderRadius: '9px', background: 'white', cursor: 'pointer' }}>{loading ? <Loader2 size={15} className="spin-anim" /> : <RefreshCw size={15} />}</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
        {error ? <div style={{ padding: '28px 12px', textAlign: 'center', color: '#b91c1c', fontSize: '0.84rem' }}>{error}</div> : visible.length ? groups.map(([directory, directoryFiles]) => <details key={directory} open style={{ marginBottom: '7px' }}><summary style={{ padding: '7px 8px', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.76rem', fontWeight: 600 }}>{directory}</summary>{directoryFiles.map((file) => (
          <div key={file.path} style={{ width: '100%', padding: '4px 6px', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '8px' }}><button type="button" onClick={() => onOpen(file)} style={{ minWidth: 0, flex: 1, padding: '6px 4px', display: 'flex', alignItems: 'center', gap: '9px', border: 0, background: 'transparent', cursor: 'pointer', textAlign: 'left', color: 'var(--text-main)' }}>
            <FileIcon type={file.previewType} /><span style={{ minWidth: 0, flex: 1 }}><span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.84rem' }}>{file.name}</span><span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px', color: 'var(--text-muted)', fontSize: '0.7rem' }}>{file.path}</span></span>
          </button><button type="button" title="重命名" onClick={() => void renameFile(file)} style={{ width: '28px', height: '28px', display: 'grid', placeItems: 'center', border: 0, background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}><Pencil size={13} /></button><button type="button" title="删除" onClick={() => void deleteFile(file)} style={{ width: '28px', height: '28px', display: 'grid', placeItems: 'center', border: 0, background: 'transparent', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={13} /></button></div>
        ))}</details>) : <div style={{ padding: '42px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.84rem' }}><FolderOpen size={28} style={{ marginBottom: '10px' }} /><div>{loading ? '正在读取工作区…' : '工作区暂无文件'}</div></div>}
      </div>
    </div>
  );
}
