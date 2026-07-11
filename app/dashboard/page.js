'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { LayoutDashboard, CreditCard, LogOut, FileSpreadsheet, Activity, Clock, FileText, Sparkles, Download, Plus, MessageSquare, Send, Paperclip, Loader2, Presentation, User, Settings, Crown, ChevronUp, X, Shield, Moon, Bell, Bot, FileJson, MoreVertical, Pin, PinOff, Edit2, Trash2, StopCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import TaskProgress from '@/app/components/TaskProgress';

export default function UserDashboard() {
  const [data, setData] = useState({ records: [], balance: 0 });
  const [stats, setStats] = useState({ totalFiles: 0, totalConsumed: 0, savedTimeHours: 0, recentTasks: [] });
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('workspace');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [activeDrawer, setActiveDrawer] = useState(null); // 'profile' | 'settings' | 'upgrade' | null
  const [activeSearchData, setActiveSearchData] = useState(null);
  const [showRightPanel, setShowRightPanel] = useState(false);
  const [rightPanelMode, setRightPanelMode] = useState('search'); // 'search' | 'preview'
  const [activeArtifact, setActiveArtifact] = useState(null);
  const [redeemCode, setRedeemCode] = useState('');
  const [redeemLoading, setRedeemLoading] = useState(false);
  const router = useRouter();

  // Chat UI states
  const [messages, setMessages] = useState([]);
  const [prompt, setPrompt] = useState('');
  const [file, setFile] = useState(null);
  const [processLoading, setProcessLoading] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState(null); // Tracks the current conversational thread context
  const messagesEndRef = useRef(null);
  
  const [openMenuId, setOpenMenuId] = useState(null);
  const [renamingTaskId, setRenamingTaskId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState({ isOpen: false, taskId: null });
  const menuRef = useRef(null);

  useEffect(() => {
    fetchData();

    // Check for intent from toolbox
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const intent = urlParams.get('intent');
      if (intent) {
        const intentPrompts = {
          'ai-summary': '我需要总结一份超长文档，请帮我提取核心观点、关键数据和最终结论，稍后我会上传文件。',
          'ai-translate': '请帮我把接下来的文档进行沉浸式双语翻译，要求保留原文档排版，语气专业自然。',
          'ai-polish': '请帮我润色接下来的公文/文案，纠正所有语病，并将语气调整为正式的商业化风格。',
          'ai-ocr': '请帮我识别接下来的发票/简历截图，并提取其中的结构化关键数据（如姓名、金额等）。'
        };
        if (intentPrompts[intent]) {
          setPrompt(intentPrompts[intent]);
          // Clear intent from URL
          window.history.replaceState({}, '', '/dashboard');
        }
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/tasks/active').then((res) => res.json()).then((payload) => {
      if (cancelled || !payload.task) return;
      const task = payload.task;
      setActiveTaskId(task._id);
      setProcessLoading(true);
      setMessages([
        { role: 'user', content: task.prompt, filename: task.filename },
        {
          role: 'ai', content: task.runtime?.streamedText || '', loading: true,
          progress: task.runtime?.progress ? { subject: task.runtime.progress.title || '正在处理任务', startedAt: new Date(task.createdAt).getTime(), steps: [task.runtime.progress] } : undefined,
        },
      ]);
      if (task.previewFile) {
        setActiveArtifact({ previewUrl: `/api/tasks/${task._id}/preview`, previewVersion: new Date(task.runtime?.updatedAt || task.updatedAt).getTime() });
        setRightPanelMode('preview');
        setShowRightPanel(true);
      }
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!activeTaskId || !processLoading) return undefined;
    const poll = async () => {
      const response = await fetch(`/api/tasks/${activeTaskId}`);
      const payload = await response.json().catch(() => null);
      const task = payload?.task;
      if (!task) return;
      setMessages((previous) => {
        if (!previous.length) return previous;
        const next = [...previous];
        const last = next[next.length - 1];
        if (last.role !== 'ai') return previous;
        next[next.length - 1] = {
          ...last,
          content: task.runtime?.streamedText || task.aiTextResponse || last.content,
          loading: ['processing', 'cancelling'].includes(task.status),
          ...(task.runtime?.progress ? { progress: { ...(last.progress || { startedAt: new Date(task.createdAt).getTime(), steps: [] }), subject: task.runtime.progress.title || '正在处理任务', steps: [task.runtime.progress] } } : {}),
        };
        return next;
      });
      if (task.previewFile) {
        setActiveArtifact((current) => ({ ...(current || {}), filename: task.outputFilename, previewUrl: `/api/tasks/${task._id}/preview`, downloadUrl: task.outputFile ? `/api/tasks/${task._id}/download` : undefined, previewVersion: new Date(task.runtime?.updatedAt || task.updatedAt).getTime() }));
        setRightPanelMode('preview');
        setShowRightPanel(true);
      }
      if (!['processing', 'cancelling'].includes(task.status)) {
        setProcessLoading(false);
        fetchData();
      }
    };
    const timer = window.setInterval(() => { void poll(); }, 1500);
    void poll();
    return () => window.clearInterval(timer);
  }, [activeTaskId, processLoading]);

  useEffect(() => {
    // Auto scroll to bottom of chat
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchData = async () => {
    try {
      const [billingRes, statsRes] = await Promise.all([
        fetch('/api/user/billing'),
        fetch('/api/user/stats')
      ]);
      
      if (billingRes.status === 401) {
        router.push('/login');
        return;
      }
      
      const billingJson = await billingRes.json();
      const statsJson = await statsRes.json();

      if (billingJson.success) setData({ records: billingJson.records, balance: billingJson.balance });
      if (statsJson.success) {
        setStats(statsJson.stats);
        if (statsJson.user) setUser(statsJson.user);
      }
      
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleRenameTask = async (e, id) => {
    e.stopPropagation();
    if (!renameValue.trim()) {
      setRenamingTaskId(null);
      return;
    }
    const toastId = toast.loading('重命名中...');
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: renameValue })
      });
      if (res.ok) {
        toast.success('已重命名', { id: toastId });
        setStats(prev => ({
          ...prev,
          recentTasks: prev.recentTasks.map(t => t._id === id ? { ...t, prompt: renameValue } : t)
        }));
      } else {
        throw new Error('Failed');
      }
    } catch(err) {
      toast.error('重命名失败', { id: toastId });
    }
    setRenamingTaskId(null);
  };

  const handleDeleteTask = async (e, id) => {
    e.stopPropagation();
    setDeleteConfirmDialog({ isOpen: true, taskId: id });
  };

  const executeDeleteTask = async () => {
    const id = deleteConfirmDialog.taskId;
    setDeleteConfirmDialog({ isOpen: false, taskId: null });
    if (!id) return;
    
    const toastId = toast.loading('删除中...');
    try {
      const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('已删除', { id: toastId });
        setStats(prev => ({
          ...prev,
          recentTasks: prev.recentTasks.filter(t => t._id !== id)
        }));
        if (activeTaskId === id) setActiveTaskId(null);
        setOpenMenuId(null);
      } else {
        throw new Error('Failed');
      }
    } catch(err) {
      toast.error('删除失败', { id: toastId });
    }
  };

  const handleTogglePin = async (e, id, currentIsPinned) => {
    e.stopPropagation();
    // Optimistic UI update
    const newIsPinned = !currentIsPinned;
    setStats(prev => {
      const updatedTasks = prev.recentTasks.map(t => t._id === id ? { ...t, isPinned: newIsPinned } : t);
      updatedTasks.sort((a, b) => (b.isPinned === a.isPinned ? new Date(b.createdAt) - new Date(a.createdAt) : b.isPinned ? 1 : -1));
      return { ...prev, recentTasks: updatedTasks };
    });

    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPinned: newIsPinned })
      });
      if (!res.ok) throw new Error('Failed');
    } catch (err) {
      toast.error('置顶操作失败');
      fetchData(); // Revert on failure
    }
  };

  const handleRedeem = async () => {
    if (!redeemCode.trim()) return toast.error('请输入卡密');
    setRedeemLoading(true);
    try {
      const res = await fetch('/api/user/billing/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: redeemCode.trim() })
      });
      const dataJson = await res.json();
      if (dataJson.success) {
        toast.success(`兑换成功！增加 ${dataJson.amount} Tokens。`);
        setRedeemCode('');
        fetchData();
      } else {
        toast.error('兑换失败: ' + dataJson.error);
      }
    } catch (e) {
      toast.error('请求错误: ' + e.message);
    } finally {
      setRedeemLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const startNewChat = () => {
    setMessages([]);
    setFile(null);
    setPrompt('');
    setActiveTaskId(null);
    setActiveTab('workspace');
    setShowRightPanel(false);
    setActiveSearchData(null);
    setActiveArtifact(null);
  };

  const loadHistoryTask = async (task) => {
    const payload = await fetch(`/api/tasks/${task._id}/conversation`).then((res) => res.json()).catch(() => null);
    const conversation = payload?.tasks || [task];
    setMessages(conversation.flatMap((turn) => [
      { role: 'user', content: turn.prompt, filename: turn.filename },
      { role: 'ai', content: turn.aiTextResponse || (turn.status === 'cancelled' ? '任务已取消。' : '处理完成。'), html: turn.htmlResult, error: turn.status === 'failed' },
    ]));
    setActiveTaskId(task._id);
    setActiveTab('workspace');
    if (task.outputFile) {
      setActiveArtifact({
        filename: task.outputFilename,
        previewUrl: `/api/tasks/${task._id}/preview`,
        downloadUrl: `/api/tasks/${task._id}/download`,
      });
      setRightPanelMode('preview');
      setShowRightPanel(true);
    } else {
      setActiveArtifact(null);
    }
  };

  const handleCancel = async () => {
    if (!activeTaskId) return;
    const response = await fetch(`/api/tasks/${activeTaskId}/cancel`, { method: 'POST' });
    if (response.ok) toast.success('正在停止任务…');
    else toast.error((await response.json().catch(() => ({}))).error || '停止失败');
  };

  const handleProcess = async () => {
    if (!prompt.trim()) return toast.error('请输入处理需求');
    // Removed strict file check to allow pure text chatting

    const currentFile = file;
    const currentPrompt = prompt;
    
    // Add user message immediately
    const newMessages = [...messages, { role: 'user', content: currentPrompt, filename: currentFile ? currentFile.name : null }];
    setMessages(newMessages);
    setPrompt('');
    setProcessLoading(true);

    // Progress is created only by real OfficeCLI events, never as a placeholder.
    setMessages([...newMessages, {
      role: 'ai', content: '', loading: true,
    }]);
    
    try {
      const formData = new FormData();
      if (currentFile) formData.append('file', currentFile);
      formData.append('prompt', currentPrompt);
      if (activeTaskId) formData.append('taskId', activeTaskId); // Pass context!

      const response = await fetch('/api/process', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const resData = await response.json().catch(() => ({}));
        throw new Error(resData.error || '处理失败');
      }

      if (!response.body) throw new Error('服务器未返回任务进度流');
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      const updateAssistant = (updater) => setMessages((previous) => {
        const next = [...previous];
        next[next.length - 1] = updater(next[next.length - 1]);
        return next;
      });
      const updateProgress = (event) => updateAssistant((message) => {
        const progress = message.progress || { subject: '正在处理任务', startedAt: Date.now(), steps: [] };
        const steps = [...progress.steps];
        if (event.id) {
          const index = steps.findIndex((step) => step.id === event.id);
          const nextStep = { ...(index >= 0 ? steps[index] : {}), ...event };
          if (index >= 0) steps[index] = nextStep;
          else steps.push(nextStep);
        }
        return { ...message, progress: { ...progress, subject: event.subject || event.title || progress.subject, steps } };
      });
      const handleEvent = (eventName, event) => {
        if (eventName === 'task') {
          if (event.taskId) setActiveTaskId(event.taskId);
        } else if (eventName === 'status') {
          // Reserved for server-reported status that is backed by actual work.
          if (!event.title) return;
          updateAssistant((message) => ({ ...message, progress: { ...message.progress, subject: event.title || message.progress.subject } }));
        } else if (['plan', 'thinking', 'tool', 'progress'].includes(eventName)) {
          if (eventName === 'plan') {
            updateAssistant((message) => ({ ...message, progress: { ...message.progress, subject: event.subject, steps: event.steps || [] } }));
          } else updateProgress(event);
        } else if (eventName === 'preview') {
          updateProgress(event);
          setActiveArtifact((current) => ({ ...(current || {}), previewUrl: event.previewUrl, previewVersion: event.version }));
          setRightPanelMode('preview');
          setShowRightPanel(true);
        } else if (eventName === 'text') {
          updateAssistant((message) => ({ ...message, content: event.content || '' }));
        } else if (eventName === 'text_delta') {
          updateAssistant((message) => ({ ...message, content: `${message.content || ''}${event.content || ''}` }));
        } else if (eventName === 'complete') {
          if (event.taskId) setActiveTaskId(event.taskId);
          if (event.artifact) setActiveArtifact(event.artifact);
          updateAssistant((message) => ({
            ...message,
            loading: false,
            ...(message.progress ? {
              progress: {
                ...message.progress,
                subject: '任务已完成',
                done: true,
                steps: (message.progress.steps || []).map((step) => step.status === 'running' ? { ...step, status: 'completed' } : step),
              },
            } : {}),
          }));
          setFile(null);
          fetchData();
        } else if (eventName === 'error') {
          throw new Error(event.error || '处理失败');
        } else if (eventName === 'cancelled') {
          updateAssistant((message) => ({ ...message, content: message.content || '任务已取消。', loading: false, error: false, ...(message.progress ? { progress: { ...message.progress, subject: '任务已取消', done: true } } : {}) }));
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const packets = buffer.split('\n\n');
        buffer = packets.pop() || '';
        for (const packet of packets) {
          const lines = packet.split('\n');
          const eventName = lines.find((line) => line.startsWith('event:'))?.slice(6).trim() || 'message';
          const rawData = lines.filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim()).join('\n');
          if (!rawData) continue;
          handleEvent(eventName, JSON.parse(rawData));
        }
      }
      updateAssistant((message) => message.loading ? {
        ...message,
        loading: false,
        ...(message.progress ? { progress: { ...message.progress, subject: '任务已结束', done: true } } : {}),
      } : message);
    } catch (err) {
      setMessages([...newMessages, { role: 'ai', content: '处理失败：' + err.message, error: true }]);
    } finally {
      setProcessLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!processLoading) handleProcess();
    }
  };

  const getFileIcon = (filename) => {
    if (!filename) return <FileSpreadsheet size={16} color="var(--primary)" />;
    if (filename.endsWith('.docx')) return <FileText size={16} color="#2563eb" />; // Word Blue
    if (filename.endsWith('.pptx')) return <Presentation size={16} color="#ea580c" />; // PPT Orange
    return <FileSpreadsheet size={16} color="#16a34a" />; // Excel Green
  };

  if (loading) return <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>加载中...</div>;

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 73px)', background: 'var(--background)', overflow: 'hidden' }}>
      
      {/* Sidebar - ChatGPT Style */}
      <aside style={{ width: '280px', background: '#f9f9f9', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
        {/* Top Nav */}
        <div style={{ padding: '16px' }}>
          <button 
            onClick={startNewChat}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 500, transition: 'all 0.2s', boxShadow: 'var(--shadow-sm)' }}
            onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
            onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            <Plus size={18} color="var(--primary)" />
            <span>开启新任务 (New Chat)</span>
          </button>
        </div>

        <nav style={{ padding: '0 16px 16px 16px', display: 'flex', flexDirection: 'column', gap: '4px', borderBottom: '1px solid var(--border)' }}>
          <button onClick={() => setActiveTab('overview')} className="admin-nav-link" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', borderRadius: 'var(--radius-md)', color: activeTab === 'overview' ? 'var(--primary)' : 'var(--text-main)', background: activeTab === 'overview' ? 'var(--primary-light)' : 'transparent', textDecoration: 'none', fontWeight: 500, border: 'none', cursor: 'pointer', textAlign: 'left' }}>
            <LayoutDashboard size={18} /> 数据概览
          </button>
          <button onClick={() => setActiveTab('billing')} className="admin-nav-link" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', borderRadius: 'var(--radius-md)', color: activeTab === 'billing' ? 'var(--primary)' : 'var(--text-main)', background: activeTab === 'billing' ? 'var(--primary-light)' : 'transparent', textDecoration: 'none', fontWeight: 500, border: 'none', cursor: 'pointer', textAlign: 'left' }}>
            <CreditCard size={18} /> 账单与流水
          </button>
        </nav>
        
        {/* History List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>历史记录 (Recent)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {stats.recentTasks && stats.recentTasks.length === 0 && (
              <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>暂无记录</div>
            )}
            {stats.recentTasks && stats.recentTasks.map(t => (
              <div 
                key={t._id} 
                style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%', gap: '4px' }}
                onMouseOver={(e) => { 
                  const actions = e.currentTarget.querySelector('.task-actions');
                  if (actions) actions.style.opacity = '1';
                }}
                onMouseOut={(e) => { 
                  const actions = e.currentTarget.querySelector('.task-actions');
                  if (actions && openMenuId !== t._id) actions.style.opacity = '0';
                }}
              >
                <button
                  onClick={() => loadHistoryTask(t)}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '12px', 
                    padding: '12px', 
                    borderRadius: 'var(--radius-md)', 
                    color: 'var(--text-main)', 
                    background: activeTaskId === t._id ? 'var(--primary-light)' : 'transparent', 
                    border: 'none', 
                    cursor: 'pointer', 
                    textAlign: 'left',
                    transition: 'background 0.2s',
                    flex: 1,
                    overflow: 'hidden'
                  }}
                  onMouseOver={(e) => { if (activeTaskId !== t._id) e.currentTarget.style.background = 'var(--background)' }}
                  onMouseOut={(e) => { if (activeTaskId !== t._id) e.currentTarget.style.background = 'transparent' }}
                >
                  <MessageSquare size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                  
                  {renamingTaskId === t._id ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={(e) => handleRenameTask(e, t._id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameTask(e, t._id);
                        if (e.key === 'Escape') setRenamingTaskId(null);
                      }}
                      onClick={e => e.stopPropagation()}
                      style={{ flex: 1, border: '1px solid var(--primary)', borderRadius: '4px', padding: '2px 4px', fontSize: '0.9rem', outline: 'none' }}
                    />
                  ) : (
                    <div style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', fontSize: '0.9rem', flex: 1 }}>
                      {t.prompt}
                    </div>
                  )}
                </button>

                <div className="task-actions" style={{ display: 'flex', alignItems: 'center', opacity: openMenuId === t._id ? 1 : 0, transition: 'opacity 0.2s', position: 'absolute', right: '4px', background: activeTaskId === t._id ? 'var(--primary-light)' : 'var(--background)', padding: '2px', borderRadius: '8px' }}>
                  <button 
                    onClick={(e) => handleTogglePin(e, t._id, t.isPinned)}
                    style={{ 
                      background: 'transparent', 
                      border: 'none', 
                      cursor: 'pointer', 
                      color: t.isPinned ? 'var(--primary)' : 'var(--text-muted)',
                      padding: '4px',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title={t.isPinned ? '取消置顶' : '置顶对话'}
                  >
                    {t.isPinned ? <PinOff size={14} /> : <Pin size={14} />}
                  </button>

                  {/* 更多菜单按钮 */}
                  <div style={{ position: 'relative' }} ref={openMenuId === t._id ? menuRef : null}>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === t._id ? null : t._id); }}
                      style={{ background: openMenuId === t._id ? 'rgba(0,0,0,0.05)' : 'transparent', border: 'none', cursor: 'pointer', padding: '6px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', borderRadius: '4px' }}
                    >
                      <MoreVertical size={16} />
                    </button>
                    
                    {/* 下拉菜单 */}
                    {openMenuId === t._id && (
                      <div style={{ position: 'absolute', right: 0, top: '100%', zIndex: 100, background: 'white', border: '1px solid var(--border)', borderRadius: '8px', boxShadow: 'var(--shadow-md)', width: '120px', padding: '4px', animation: 'fadeIn 0.15s ease-out', marginTop: '4px' }}>
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            setRenamingTaskId(t._id); 
                            setRenameValue(t.prompt);
                            setOpenMenuId(null);
                          }}
                          style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 12px', background: 'transparent', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-main)', textAlign: 'left' }}
                          onMouseOver={e=>e.currentTarget.style.background='var(--background)'}
                          onMouseOut={e=>e.currentTarget.style.background='transparent'}
                        >
                          <Edit2 size={14} /> 重命名
                        </button>
                        <button 
                          onClick={(e) => handleDeleteTask(e, t._id)}
                          style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 12px', background: 'transparent', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem', color: '#ef4444', textAlign: 'left' }}
                          onMouseOver={e=>e.currentTarget.style.background='#fee2e2'}
                          onMouseOut={e=>e.currentTarget.style.background='transparent'}
                        >
                          <Trash2 size={14} /> 删除
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Bottom User Info */}
        <div style={{ position: 'relative', padding: '12px', borderTop: '1px solid var(--border)', background: 'white' }}>
          
          {/* User Menu Popup */}
          {showUserMenu && (
            <div style={{ position: 'absolute', bottom: 'calc(100% + 8px)', left: '12px', right: '12px', background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden', zIndex: 100, animation: 'fadeIn 0.2s ease-out' }}>
              
              {/* Account Level */}
              <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', background: 'var(--background)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>当前套餐</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
                  <Crown size={16} color="#d97706" /> 免费版用户
                </div>
              </div>

              <div style={{ padding: '8px' }}>
                <button 
                  onClick={() => { setActiveDrawer('upgrade'); setShowUserMenu(false); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', width: '100%', background: 'transparent', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', textAlign: 'left', transition: 'background 0.2s' }}
                  onMouseOver={e => e.currentTarget.style.background = 'var(--background)'}
                  onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                >
                  <Crown size={16} color="var(--primary)" /> 升级套餐 (Upgrade Plan)
                </button>
                <button 
                  onClick={() => { setActiveDrawer('profile'); setShowUserMenu(false); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', width: '100%', background: 'transparent', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', textAlign: 'left', transition: 'background 0.2s' }}
                  onMouseOver={e => e.currentTarget.style.background = 'var(--background)'}
                  onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                >
                  <User size={16} /> 个人资料 (Profile)
                </button>
                <button 
                  onClick={() => { setActiveDrawer('settings'); setShowUserMenu(false); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', width: '100%', background: 'transparent', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', textAlign: 'left', transition: 'background 0.2s' }}
                  onMouseOver={e => e.currentTarget.style.background = 'var(--background)'}
                  onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                >
                  <Settings size={16} /> 设置 (Settings)
                </button>
              </div>
              
              <div style={{ padding: '8px', borderTop: '1px solid var(--border)' }}>
                <button 
                  onClick={handleLogout}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', width: '100%', background: 'transparent', color: '#ef4444', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', textAlign: 'left', transition: 'background 0.2s' }}
                  onMouseOver={e => e.currentTarget.style.background = '#fee2e2'}
                  onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                >
                  <LogOut size={16} /> 退出登录 (Log out)
                </button>
              </div>
            </div>
          )}

          {/* User Button */}
          <button 
            onClick={() => setShowUserMenu(!showUserMenu)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', width: '100%', background: showUserMenu ? 'var(--background)' : 'transparent', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', transition: 'background 0.2s' }}
            onMouseOver={e => { if (!showUserMenu) e.currentTarget.style.background = 'var(--background)' }}
            onMouseOut={e => { if (!showUserMenu) e.currentTarget.style.background = 'transparent' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary) 0%, #6366f1 100%)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.2rem', flexShrink: 0 }}>
                {user?.username?.[0]?.toUpperCase() || 'U'}
              </div>
              <div style={{ textAlign: 'left', overflow: 'hidden' }}>
                <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-main)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                  {user?.username || '用户'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                  {user?.email || 'user@example.com'}
                </div>
              </div>
            </div>
            <ChevronUp size={16} color="var(--text-muted)" style={{ transform: showUserMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        
        {/* Chat UI */}
        {activeTab === 'workspace' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'row', height: '100%', overflow: 'hidden' }}>
            
            {/* Left Column (Chat Area + Input) */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
            
            {/* Chat Area */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
              {messages.length === 0 ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', padding: '0 20px' }}>
                  <Sparkles size={48} color="var(--primary)" style={{ marginBottom: '24px', opacity: 0.8 }} />
                  <h2 style={{ marginBottom: '12px', color: 'var(--text-main)', fontSize: '1.8rem', fontWeight: 700 }}>我能帮您做什么？</h2>
                  <p style={{ marginBottom: '40px', fontSize: '1.1rem' }}>上传 Excel、Word 或 PPT，并描述您的需求，我将为您自动完成文档处理。</p>
                  
                  {/* Suggestion Buttons */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', width: '100%', maxWidth: '800px' }}>
                    <button onClick={() => setPrompt('请帮我写一份年度述职 PPT 的详细大纲，包含数据回顾和明年规划。')} style={{ padding: '16px', background: 'white', border: '1px solid var(--border)', borderRadius: '16px', textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s', boxShadow: 'var(--shadow-sm)' }} onMouseOver={e => {e.currentTarget.style.borderColor='var(--primary)'; e.currentTarget.style.transform='translateY(-2px)'}} onMouseOut={e => {e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.transform='none'}}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--text-main)', fontWeight: 600 }}><Presentation size={18} color="#ea580c" /> 生成演示文稿</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>帮我写一份年度述职 PPT 的详细大纲，包含数据回顾...</div>
                    </button>
                    <button onClick={() => setPrompt('请分析这份 Excel 表格中的月度财务趋势，找出异常数据并生成总结报告。')} style={{ padding: '16px', background: 'white', border: '1px solid var(--border)', borderRadius: '16px', textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s', boxShadow: 'var(--shadow-sm)' }} onMouseOver={e => {e.currentTarget.style.borderColor='var(--primary)'; e.currentTarget.style.transform='translateY(-2px)'}} onMouseOut={e => {e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.transform='none'}}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--text-main)', fontWeight: 600 }}><FileSpreadsheet size={18} color="#16a34a" /> 深度数据分析</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>分析 Excel 表格中的月度财务趋势，找出异常数据...</div>
                    </button>
                    <button onClick={() => setPrompt('我需要总结一份超长文档，请帮我提取核心观点、关键数据和最终结论。')} style={{ padding: '16px', background: 'white', border: '1px solid var(--border)', borderRadius: '16px', textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s', boxShadow: 'var(--shadow-sm)' }} onMouseOver={e => {e.currentTarget.style.borderColor='var(--primary)'; e.currentTarget.style.transform='translateY(-2px)'}} onMouseOut={e => {e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.transform='none'}}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--text-main)', fontWeight: 600 }}><Bot size={18} color="#8b5cf6" /> 极速提炼总结</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>总结超长文档，提取核心观点、关键数据和最终结论...</div>
                    </button>
                    <button onClick={() => setPrompt('请将这份公文的排版进行专业润色，纠正所有语病，并将语气调整为正式的商业化风格。')} style={{ padding: '16px', background: 'white', border: '1px solid var(--border)', borderRadius: '16px', textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s', boxShadow: 'var(--shadow-sm)' }} onMouseOver={e => {e.currentTarget.style.borderColor='var(--primary)'; e.currentTarget.style.transform='translateY(-2px)'}} onMouseOut={e => {e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.transform='none'}}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--text-main)', fontWeight: 600 }}><Sparkles size={18} color="#3b82f6" /> 智能公文润色</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>将公文的排版进行专业润色，纠正所有语病...</div>
                    </button>
                    <button onClick={() => setPrompt('请帮我将接下来的文档进行沉浸式双语翻译，要求保留核心结构，语气专业自然。')} style={{ padding: '16px', background: 'white', border: '1px solid var(--border)', borderRadius: '16px', textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s', boxShadow: 'var(--shadow-sm)' }} onMouseOver={e => {e.currentTarget.style.borderColor='var(--primary)'; e.currentTarget.style.transform='translateY(-2px)'}} onMouseOut={e => {e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.transform='none'}}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--text-main)', fontWeight: 600 }}><MessageSquare size={18} color="#06b6d4" /> 专业内容翻译</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>进行沉浸式双语翻译，保留核心结构，语气专业...</div>
                    </button>
                    <button onClick={() => setPrompt('请帮我提取接下来文档中的结构化关键数据（如姓名、金额、日期等），并用表格清晰展示。')} style={{ padding: '16px', background: 'white', border: '1px solid var(--border)', borderRadius: '16px', textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s', boxShadow: 'var(--shadow-sm)' }} onMouseOver={e => {e.currentTarget.style.borderColor='var(--primary)'; e.currentTarget.style.transform='translateY(-2px)'}} onMouseOut={e => {e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.transform='none'}}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--text-main)', fontWeight: 600 }}><FileJson size={18} color="#eab308" /> 票据简历提取</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>提取结构化关键数据（如姓名、金额、日期等）...</div>
                    </button>
                  </div>
                </div>
              ) : (
                messages.map((msg, i) => (
                  <div key={i} style={{ display: 'flex', gap: '16px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
                    {msg.role === 'ai' ? (
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Sparkles size={20} color="var(--primary)" />
                      </div>
                    ) : (
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--text-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'white', fontWeight: 'bold' }}>
                        U
                      </div>
                    )}
                    
                    <div style={{ flex: 1, paddingTop: '6px' }}>
                      <div style={{ fontWeight: 600, marginBottom: '8px', color: 'var(--text-main)' }}>
                        {msg.role === 'ai' ? 'OfficeGPT' : '您'}
                      </div>
                      
                      {/* User File Attachment */}
                      {msg.role === 'user' && msg.filename && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginBottom: '12px', fontSize: '0.9rem' }}>
                          {getFileIcon(msg.filename)}
                          <span style={{ fontWeight: 500 }}>{msg.filename}</span>
                        </div>
                      )}

                      {/* Text Content */}
                      {msg.progress && <TaskProgress progress={msg.progress} />}
                      {msg.loading && !msg.searchData && !msg.progress ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
                          <Loader2 size={16} className="spin-anim" /> 思考中...
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                          {/* Search Data Tool Block */}
                          {msg.searchData && (
                            <div style={{ padding: '12px 16px', background: '#f8fafc', border: '1px solid var(--border)', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)', fontSize: '0.9rem' }}>
                                <div style={{ background: 'var(--primary-light)', padding: '6px', borderRadius: '8px' }}>
                                  <Sparkles size={16} color="var(--primary)" />
                                </div>
                                <span style={{ fontWeight: 600 }}>使用工具：实时搜索网络</span>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>关键词："{msg.searchData.keyword}" ({msg.searchData.results?.length || 0}条结果)</span>
                              </div>
                              <button 
                                onClick={() => { setActiveSearchData(msg.searchData); setRightPanelMode('search'); setShowRightPanel(true); }}
                                style={{ background: 'white', border: '1px solid var(--border)', padding: '6px 12px', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 500 }}
                              >
                                查看详情
                              </button>
                            </div>
                          )}
                          
                          {msg.loading && msg.searchData && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
                              <Loader2 size={16} className="spin-anim" /> 阅读并总结网络资料中...
                            </div>
                          )}

                          <div className="markdown-body" style={{ lineHeight: '1.6', color: msg.error ? '#ef4444' : 'var(--text-main)' }}>
                          {msg.error ? (
                            <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                          ) : (
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                code({node, inline, className, children, ...props}) {
                                  const match = /language-(\w+)/.exec(className || '');
                                  let language = match ? match[1] : '';
                                  const codeText = String(children).replace(/\n$/, '');
                                  
                                  // Fallback: If AI forgets the ```doc_script tag but the content is clearly a script
                                  if (!inline && !language && codeText.trim().startsWith('office' + 'cli ')) {
                                    language = 'doc_script';
                                  }

                                  // Completely hide internal script from the left chat flow, as we render preview on the right
                                  if (language === 'doc_script' || language === 'officecli') {
                                    return null;
                                  }

                                  if (!inline && language) {
                                    return (
                                      <div style={{ margin: '16px 0', border: '1px solid var(--border)', borderRadius: '8px', overflowX: 'auto', maxWidth: '100%', background: 'transparent' }}>
                                          <SyntaxHighlighter
                                            {...props}
                                            children={codeText}
                                            style={oneLight}
                                            language={language}
                                            PreTag="div"
                                            customStyle={{ margin: 0, padding: '16px', fontSize: '0.9rem', borderRadius: 0, border: 'none' }}
                                          />
                                      </div>
                                    );
                                  }
                                  return (
                                    <code {...props} className={className} style={{ background: 'var(--background)', padding: '3px 6px', borderRadius: '4px', color: '#e53e3e', fontSize: '0.9em' }}>
                                      {children}
                                    </code>
                                  )
                                },
                                table: ({node, ...props}) => <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }} {...props} />,
                                th: ({node, ...props}) => <th style={{ border: '1px solid var(--border)', padding: '12px', background: 'var(--background)', textAlign: 'left', fontWeight: 600 }} {...props} />,
                                td: ({node, ...props}) => <td style={{ border: '1px solid var(--border)', padding: '12px' }} {...props} />,
                                a: ({node, ...props}) => <a style={{ color: 'var(--primary)', textDecoration: 'none' }} {...props} />,
                                h1: ({node, ...props}) => <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '24px 0 16px 0' }} {...props} />,
                                h2: ({node, ...props}) => <h2 style={{ fontSize: '1.3rem', fontWeight: 600, margin: '24px 0 16px 0' }} {...props} />,
                                h3: ({node, ...props}) => <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: '20px 0 12px 0' }} {...props} />,
                                ul: ({node, ...props}) => <ul style={{ paddingLeft: '24px', marginBottom: '16px', listStyleType: 'disc' }} {...props} />,
                                ol: ({node, ...props}) => <ol style={{ paddingLeft: '24px', marginBottom: '16px', listStyleType: 'decimal' }} {...props} />,
                                li: ({node, ...props}) => <li style={{ marginBottom: '8px' }} {...props} />,
                                p: ({node, ...props}) => <p style={{ marginBottom: '16px' }} {...props} />
                              }}
                            >
                              {msg.content}
                            </ReactMarkdown>
                          )}
                        </div>
                      </div>
                      )}

                      {/* HTML Result View */}
                      {msg.html && (
                        <div style={{ marginTop: '16px', background: 'white', padding: '24px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', overflowX: 'auto', boxShadow: 'var(--shadow-sm)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-muted)' }}>处理结果预览</span>
                            <button className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', gap: '6px', alignItems: 'center' }}>
                              <Download size={14} /> 下载结果文档
                            </button>
                          </div>
                          <div dangerouslySetInnerHTML={{ __html: msg.html }} />
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
              
              {/* Active File Preview */}
              {file && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'white', border: '1px solid var(--primary-light)', borderRadius: 'var(--radius-md)', marginBottom: '12px', fontSize: '0.9rem', boxShadow: 'var(--shadow-sm)' }}>
                  {getFileIcon(file.name)}
                  <span style={{ fontWeight: 500 }}>{file.name}</span>
                  <button onClick={() => setFile(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', marginLeft: '8px' }}>×</button>
                </div>
              )}

              <div style={{ position: 'relative', background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', transition: 'all 0.3s' }}>
                <textarea 
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={activeTaskId ? "在此文件基础上，继续补充处理需求..." : "上传 Excel、Word 或 PPT 文档并描述您的需求..."}
                  style={{ width: '100%', minHeight: '60px', maxHeight: '200px', padding: '16px 48px 16px 48px', border: 'none', borderRadius: 'var(--radius-lg)', resize: 'none', outline: 'none', fontSize: '1rem', lineHeight: '1.5', background: 'transparent' }}
                  disabled={processLoading}
                />
                
                {/* Upload Button */}
                <div style={{ position: 'absolute', left: '12px', bottom: '12px' }}>
                  <input type="file" id="file-upload" accept=".xlsx,.docx,.pptx" onChange={handleFileChange} style={{ display: 'none' }} disabled={processLoading} />
                  <label htmlFor="file-upload" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '50%', background: 'var(--background)', color: 'var(--text-muted)', transition: 'all 0.2s' }}>
                    <Paperclip size={18} />
                  </label>
                </div>

                {/* Send / Stop Button */}
                <button 
                  onClick={processLoading ? handleCancel : handleProcess}
                  disabled={!processLoading && !prompt.trim()}
                  title={processLoading ? '停止生成' : '发送'}
                  style={{ position: 'absolute', right: '12px', bottom: '12px', width: '32px', height: '32px', borderRadius: '50%', background: processLoading || prompt.trim() ? 'var(--primary)' : 'var(--background)', color: processLoading || prompt.trim() ? 'white' : 'var(--text-muted)', border: 'none', cursor: processLoading || prompt.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                >
                  {processLoading ? <StopCircle size={16} /> : <Send size={16} style={{ marginLeft: '2px' }} />}
                </button>
              </div>
              <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                支持 Excel、Word 和 PPT。你可以连续发送多条指令在同一个文档上叠加操作。
              </div>
            </div>
          </div>

        {/* Right Dynamic Panel (Search / Preview) */}
        {showRightPanel && (
          <div style={{ width: '400px', flexShrink: 0, background: 'white', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', animation: 'slideInRight 0.3s ease-out' }}>
            <div style={{ padding: '20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.2rem', margin: 0 }}>
                {rightPanelMode === 'search' ? '网页搜索参考资料' : 'Office 真实预览'}
              </h3>
              <button onClick={() => setShowRightPanel(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
              
              {/* Mode: Search Results */}
              {rightPanelMode === 'search' && activeSearchData && (
                <>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                    搜索关键词：<strong style={{ color: 'var(--primary)' }}>{activeSearchData.keyword}</strong>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {activeSearchData.results.map((r, idx) => (
                      <div key={idx} style={{ padding: '16px', border: '1px solid var(--border)', borderRadius: '12px', background: '#f8fafc' }}>
                        <a href={r.link} target="_blank" rel="noopener noreferrer" style={{ display: 'block', fontWeight: 600, fontSize: '1.05rem', color: '#2563eb', marginBottom: '8px', textDecoration: 'none' }}>
                          {r.title}
                        </a>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-main)', lineHeight: '1.5' }}>
                          {r.snippet}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {rightPanelMode === 'preview' && activeArtifact && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
                  <iframe
                    key={`${activeArtifact.previewUrl}:${activeArtifact.previewVersion || 0}`}
                    src={`${activeArtifact.previewUrl}?v=${activeArtifact.previewVersion || 0}`}
                    title="Office document preview"
                    sandbox="allow-scripts"
                    style={{ width: '100%', minHeight: '560px', flex: 1, border: '1px solid var(--border)', borderRadius: '8px', background: 'white' }}
                  />
                  {activeArtifact.downloadUrl ? (
                    <a href={activeArtifact.downloadUrl} className="btn btn-primary" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <Download size={18} /> 下载 {activeArtifact.filename || 'Office 文件'}
                    </a>
                  ) : <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>正在生成，右侧预览会随 OfficeCLI 的渲染结果更新…</div>}
                </div>
              )}

            </div>
          </div>
        )}

        {/* Custom Confirm Modal for Delete */}
        {deleteConfirmDialog.isOpen && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }} onClick={() => setDeleteConfirmDialog({ isOpen: false, taskId: null })}></div>
            <div style={{ background: 'white', padding: '32px', borderRadius: '16px', width: '90%', maxWidth: '400px', position: 'relative', zIndex: 1, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Trash2 size={24} style={{ color: 'var(--danger, #ef4444)' }} />
                删除确认
              </h3>
              <p style={{ color: 'var(--text-muted)', marginBottom: '24px', lineHeight: 1.5 }}>
                您确定要删除这条历史记录吗？<br/>删除后该文档及对话上下文将无法恢复。
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button 
                  onClick={() => setDeleteConfirmDialog({ isOpen: false, taskId: null })}
                  style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-main)', cursor: 'pointer', fontWeight: 500 }}
                >
                  取消
                </button>
                <button 
                  onClick={executeDeleteTask}
                  style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'var(--danger, #ef4444)', color: 'white', cursor: 'pointer', fontWeight: 500 }}
                >
                  确认删除
                </button>
              </div>
            </div>
          </div>
        )}
        
        </div>
        )}

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div style={{ padding: '40px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
              <h1 style={{ fontSize: '1.8rem' }}>数据概览</h1>
            </div>
            {/* Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '24px', marginBottom: '32px' }}>
              <div className="glass-card" style={{ padding: '24px', background: 'white', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '16px', borderRadius: '50%' }}><FileText color="var(--primary)" size={24} /></div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '4px' }}>总处理文件数</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.totalFiles} <span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: 'var(--text-muted)' }}>份</span></div>
                </div>
              </div>
              <div className="glass-card" style={{ padding: '24px', background: 'white', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ background: '#fef3c7', padding: '16px', borderRadius: '50%' }}><Activity color="#d97706" size={24} /></div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '4px' }}>累计消耗 Tokens</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.totalConsumed}</div>
                </div>
              </div>
              <div className="glass-card" style={{ padding: '24px', background: 'white', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ background: '#e0e7ff', padding: '16px', borderRadius: '50%' }}><Clock color="#4f46e5" size={24} /></div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '4px' }}>预估节省时间</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.savedTimeHours} <span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: 'var(--text-muted)' }}>小时</span></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Billing Tab */}
        {activeTab === 'billing' && (
          <div style={{ padding: '40px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
              <h1 style={{ fontSize: '1.8rem' }}>账单与流水</h1>
            </div>
            <div className="glass-card" style={{ padding: '32px', background: 'white', marginBottom: '32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ color: 'var(--text-muted)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}><CreditCard size={18} /> 当前可用 Tokens 余额</div>
                <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--primary)' }}>{data.balance.toLocaleString()}</div>
              </div>
              <button className="btn btn-outline">充值卡密兑换</button>
            </div>

            <div className="glass-card" style={{ background: 'white', padding: '0', overflow: 'hidden' }}>
              <h2 style={{ fontSize: '1.2rem', padding: '24px', borderBottom: '1px solid var(--border)' }}>近期账单流水</h2>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--background)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '16px', fontWeight: 600 }}>时间</th>
                    <th style={{ padding: '16px', fontWeight: 600 }}>类型</th>
                    <th style={{ padding: '16px', fontWeight: 600 }}>详情</th>
                    <th style={{ padding: '16px', fontWeight: 600 }}>额度变动</th>
                  </tr>
                </thead>
                <tbody>
                  {data.records.length === 0 && (
                    <tr><td colSpan="4" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>暂无账单记录</td></tr>
                  )}
                  {data.records.map(r => (
                    <tr key={r._id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '16px' }}>{new Date(r.createdAt).toLocaleString()}</td>
                      <td style={{ padding: '16px' }}>
                        <span style={{ padding: '4px 8px', background: r.type === 'charge' ? '#d1fae5' : '#fee2e2', color: r.type === 'charge' ? '#059669' : '#ef4444', borderRadius: '4px', fontSize: '0.8rem' }}>
                          {r.type === 'charge' ? '充值' : '消费'}
                        </span>
                      </td>
                      <td style={{ padding: '16px', color: 'var(--text-muted)' }}>{r.description}</td>
                      <td style={{ padding: '16px', fontWeight: 'bold', color: r.type === 'charge' ? '#059669' : '#ef4444' }}>
                        {r.type === 'charge' ? '+' : '-'}{r.amount.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
      
      {/* Global Centered Modal */}
      {activeDrawer && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          
          {/* Backdrop */}
          <div 
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)', animation: 'fadeIn 0.2s ease-out' }} 
            onClick={() => setActiveDrawer(null)}
          />
          
          {/* Modal Panel */}
          <div style={{ width: '480px', maxWidth: '100%', maxHeight: '90vh', background: '#fefefe', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', position: 'relative', zIndex: 1, animation: 'scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            
            {/* Modal Header */}
            <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'white' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px' }}>
                {activeDrawer === 'upgrade' && <><Crown color="var(--primary)" /> 升级套餐</>}
                {activeDrawer === 'profile' && <><User color="var(--text-main)" /> 个人资料</>}
                {activeDrawer === 'settings' && <><Settings color="var(--text-main)" /> 系统设置</>}
              </h2>
              <button 
                onClick={() => setActiveDrawer(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onMouseOver={e => e.currentTarget.style.background = 'var(--background)'}
                onMouseOut={e => e.currentTarget.style.background = 'transparent'}
              >
                <X size={20} color="var(--text-muted)" />
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
              
              {/* UPGRADE PLAN CONTENT */}
              {activeDrawer === 'upgrade' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  <div style={{ padding: '24px', background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.05) 0%, rgba(99, 102, 241, 0.1) 100%)', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(79, 70, 229, 0.2)' }}>
                    <div style={{ color: 'var(--text-muted)', marginBottom: '8px', fontSize: '0.9rem' }}>当前可用 Tokens 余额</div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--primary)' }}>{data.balance.toLocaleString()}</div>
                  </div>
                  
                  <div>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', color: 'var(--text-main)' }}>卡密充值兑换</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <input 
                        type="text" 
                        placeholder="请输入您的 16 位激活卡密" 
                        value={redeemCode}
                        onChange={e => setRedeemCode(e.target.value)}
                        style={{ padding: '14px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', fontSize: '1rem', outline: 'none' }}
                      />
                      <button 
                        onClick={handleRedeem}
                        disabled={redeemLoading || !redeemCode.trim()}
                        style={{ padding: '14px', borderRadius: 'var(--radius-md)', background: redeemLoading || !redeemCode.trim() ? '#d1d5db' : 'var(--primary)', color: 'white', fontWeight: 600, border: 'none', cursor: redeemLoading || !redeemCode.trim() ? 'not-allowed' : 'pointer', transition: 'background 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                      >
                        {redeemLoading && <Loader2 size={16} className="spin-anim" />}
                        立即兑换额度
                      </button>
                    </div>
                  </div>
                  
                  <div style={{ marginTop: '24px', padding: '16px', background: '#f8fafc', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                    <p style={{ marginBottom: '8px', fontWeight: 600, color: 'var(--text-main)' }}>充值说明：</p>
                    <p>1. Tokens 用于支付每次调用 AI 核心模型处理文档的计算成本。</p>
                    <p>2. 卡密一经兑换即刻生效，不设有效期。</p>
                    <p>3. 如需大客户专属私有化模型接入方案，请联系官方支持团队。</p>
                  </div>
                </div>
              )}

              {/* PROFILE CONTENT */}
              {activeDrawer === 'profile' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary) 0%, #6366f1 100%)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '2.5rem', marginBottom: '16px', boxShadow: 'var(--shadow-md)' }}>
                      {user?.username?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <h3 style={{ fontSize: '1.4rem', fontWeight: 600, marginBottom: '4px' }}>{user?.username || '用户'}</h3>
                    <p style={{ color: 'var(--text-muted)' }}>{user?.email || 'user@example.com'}</p>
                  </div>

                  <div>
                    <h4 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '12px', textTransform: 'uppercase' }}>账户权限</h4>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'var(--background)', borderRadius: 'var(--radius-md)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Shield size={20} color={user?.role === 'admin' ? '#ef4444' : 'var(--primary)'} />
                        <span style={{ fontWeight: 500 }}>当前角色</span>
                      </div>
                      <span style={{ background: user?.role === 'admin' ? '#fee2e2' : 'var(--primary-light)', color: user?.role === 'admin' ? '#ef4444' : 'var(--primary)', padding: '4px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600 }}>
                        {user?.role === 'admin' ? '超级管理员' : '普通用户'}
                      </span>
                    </div>
                  </div>

                  {user?.role === 'admin' && (
                    <div style={{ marginTop: '12px' }}>
                      <button 
                        onClick={() => router.push('/admin')}
                        style={{ width: '100%', padding: '14px', background: 'white', border: '1px solid #ef4444', color: '#ef4444', borderRadius: 'var(--radius-md)', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                        onMouseOver={e => e.currentTarget.style.background = '#fee2e2'}
                        onMouseOut={e => e.currentTarget.style.background = 'white'}
                      >
                        进入后台管理系统
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* SETTINGS CONTENT */}
              {activeDrawer === 'settings' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                  
                  {/* Theme Section */}
                  <section>
                    <h4 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '16px', textTransform: 'uppercase' }}>外观偏好</h4>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ padding: '8px', background: 'var(--background)', borderRadius: '8px' }}><Moon size={18} color="var(--text-main)" /></div>
                        <div>
                          <div style={{ fontWeight: 500 }}>深色模式</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>切换至暗黑主题界面</div>
                        </div>
                      </div>
                      <div style={{ width: '44px', height: '24px', background: 'var(--border)', borderRadius: '12px', position: 'relative', cursor: 'not-allowed', opacity: 0.5 }}>
                        <div style={{ width: '20px', height: '20px', background: 'white', borderRadius: '50%', position: 'absolute', top: '2px', left: '2px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} />
                      </div>
                    </div>
                  </section>

                  {/* Notification Section */}
                  <section>
                    <h4 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '16px', textTransform: 'uppercase' }}>通知设置</h4>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ padding: '8px', background: 'var(--primary-light)', borderRadius: '8px' }}><Bell size={18} color="var(--primary)" /></div>
                        <div>
                          <div style={{ fontWeight: 500 }}>任务完成提示音</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>大文件处理完毕时播放声音</div>
                        </div>
                      </div>
                      <div style={{ width: '44px', height: '24px', background: 'var(--primary)', borderRadius: '12px', position: 'relative', cursor: 'pointer' }}>
                        <div style={{ width: '20px', height: '20px', background: 'white', borderRadius: '50%', position: 'absolute', top: '2px', right: '2px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} />
                      </div>
                    </div>
                  </section>
                  
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '32px' }}>
                    OfficeGPT Web Application v1.0.0
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .spin-anim {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
