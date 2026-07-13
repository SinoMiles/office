'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { LayoutDashboard, CreditCard, LogOut, FileSpreadsheet, Activity, Clock, FileText, Sparkles, Plus, MessageSquare, Send, Paperclip, Loader2, Presentation, User, Settings, Crown, ChevronUp, X, Shield, Moon, Bell, Bot, FileJson, MoreVertical, Pin, PinOff, Edit2, Trash2, StopCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import TaskProgress from '@/app/components/TaskProgress';
import Thinking from '@/app/components/Thinking';
import { useAioncoreChat } from '@/app/hooks/useAioncoreChat';

export default function UserDashboard() {
  const [data, setData] = useState({ records: [], balance: 0 });
  const [stats, setStats] = useState({ totalFiles: 0, totalConsumed: 0, savedTimeHours: 0, recentTasks: [] });
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('workspace');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [activeDrawer, setActiveDrawer] = useState(null); // 'profile' | 'settings' | 'upgrade' | null
  const [showRightPanel, setShowRightPanel] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeArtifact, setActiveArtifact] = useState(null);
  const [redeemCode, setRedeemCode] = useState('');
  const [redeemLoading, setRedeemLoading] = useState(false);
  const router = useRouter();

  // AionCore hook
  const { messages: aionMessages, officeArtifact, isProcessing: aionIsProcessing, sendMessage, loadConversation, waitUntilConnected, cancelGeneration } = useAioncoreChat();

  // Chat UI states
  const [messages, setMessages] = useState([]);
  const [prompt, setPrompt] = useState('');
  const [file, setFile] = useState(null);
  const [processLoading, setProcessLoading] = useState(false);
  const isGenerating = processLoading || aionIsProcessing;
  const [activeTaskId, setActiveTaskId] = useState(null); // Tracks the current conversational thread context
  const messagesEndRef = useRef(null);
  
  const [openMenuId, setOpenMenuId] = useState(null);
  const [renamingTaskId, setRenamingTaskId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState({ isOpen: false, taskId: null });
  const menuRef = useRef(null);
  const lastPreviewVersionRef = useRef(null);

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
          'ai-ocr': '请帮我识别接下来的发票/简历截图，并提取其中的结构化关键数据（如姓名、金额等）。',
          'ai-pdf-chat': '请阅读我接下来上传的 PDF。先概括文档结构，然后根据文档内容回答我的问题，并说明答案对应的章节或依据。',
          'ai-contract-review': '请审查我接下来上传的合同，识别风险条款、责任边界、违约责任、期限、费用和缺失条款，并按风险等级给出修改建议。',
          'ai-document-compare': '请对比我接下来上传或粘贴的两个文档版本，重点归纳实质性修改、数据变化、责任变化和可能产生的影响。',
          'ai-redact': '请识别文档中的姓名、电话、证件号、地址、银行卡、邮箱等敏感信息，给出结构化脱敏清单和安全替换建议。',
          'ai-meeting-minutes': '请把接下来的会议记录整理为正式会议纪要，包含议题、关键讨论、结论、待办、负责人和截止时间。',
          'ai-weekly-report': '请把我接下来提供的工作记录整理成周报，突出完成事项、关键成果、问题风险和下周计划。',
          'ai-annual-review': '请根据我接下来提供的工作成果和数据生成年度述职，包含成果回顾、关键数据、能力成长、问题复盘和明年规划。',
          'ai-resume': '请根据目标岗位优化我接下来上传的简历，强化岗位匹配、量化成果、关键词覆盖和表达专业度。',
          'ai-excel-analysis': '请分析我接下来上传的表格，检查数据质量，识别趋势、异常和关键指标，并给出适合的图表与业务结论。',
          'ai-ppt-outline': '请根据我接下来提供的主题、资料和受众，生成逻辑完整的 PPT 大纲，逐页说明标题、核心内容和视觉呈现建议。',
          'ai-official-document': '请检查我接下来提供的公文，重点审核结构、标题、措辞、语气、格式规范和常见错误，并给出修改后的版本。'
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
    const setFromEvent = (event) => setSidebarCollapsed(Boolean(event.detail?.collapsed));
    const reportState = () => window.dispatchEvent(new CustomEvent('office-sidebar-state', { detail: { collapsed: sidebarCollapsed } }));
    window.addEventListener('office-sidebar-set', setFromEvent);
    window.addEventListener('office-sidebar-query', reportState);
    window.dispatchEvent(new CustomEvent('office-sidebar-state', { detail: { collapsed: sidebarCollapsed } }));
    return () => {
      window.removeEventListener('office-sidebar-set', setFromEvent);
      window.removeEventListener('office-sidebar-query', reportState);
    };
  }, [sidebarCollapsed]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/tasks/active').then((res) => res.json()).then((payload) => {
      if (cancelled || !payload.task) return;
      const task = payload.task;
      setActiveTaskId(task._id);
      setProcessLoading(true);
      const runtimeProgress = ['tool', 'progress', 'preview'].includes(task.runtime?.progress?.type) ? task.runtime.progress : null;
      setMessages([
        { role: 'user', content: task.prompt, filename: task.filename },
        {
          role: 'ai', content: task.runtime?.streamedText || '', loading: true,
          thought: task.runtime?.thought?.description ? task.runtime.thought : undefined,
          progress: runtimeProgress ? { subject: runtimeProgress.title || '正在处理任务', startedAt: new Date(task.createdAt).getTime(), steps: [runtimeProgress] } : undefined,
        },
      ]);
      if (task.previewFile && task.runtime?.progress?.type === 'preview') {
        const version = new Date(task.runtime?.updatedAt || task.updatedAt).getTime();
        setActiveArtifact({ previewUrl: `/api/tasks/${task._id}/preview`, previewVersion: version });
        lastPreviewVersionRef.current = version;
        setShowRightPanel(true);
        setSidebarCollapsed(true);
      }
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    // We no longer poll MongoDB for real-time generation updates since AionCore streams via WS.
    // Instead, we just sync the real-time aionMessages into our local state.
    if (aionMessages && aionMessages.length > 0) {
       const lastAionMsg = aionMessages[aionMessages.length - 1];
       if (lastAionMsg && lastAionMsg.role === 'ai') {
         setMessages(prev => {
            const next = [...prev];
            if (next.length > 0 && next[next.length - 1].role === 'ai') {
               next[next.length - 1] = { ...next[next.length - 1], ...lastAionMsg, loading: aionIsProcessing };
            } else {
               next.push({ ...lastAionMsg, loading: aionIsProcessing });
            }
            return next;
         });
       }
    }
  }, [aionMessages, aionIsProcessing]);

  useEffect(() => {
    if (!officeArtifact) return;
    setActiveArtifact(officeArtifact);
    setShowRightPanel(true);
    setSidebarCollapsed(true);
  }, [officeArtifact]);

  useEffect(() => {
    // Sync completion status back to MongoDB when aioncore finishes generating
    if (!aionIsProcessing && processLoading && activeTaskId && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && lastMsg.role === 'ai') {
        fetch(`/api/tasks/${activeTaskId}/finish`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: lastMsg.content })
        }).catch(e => console.error('Failed to sync finish state', e));
        setProcessLoading(false);
      }
    }
  }, [aionIsProcessing, processLoading, activeTaskId]);

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
    setSidebarCollapsed(false);
    setActiveArtifact(null);
  };

  const loadHistoryTask = async (task) => {
    const payload = await fetch(`/api/tasks/${task._id}/conversation`).then((res) => res.json()).catch(() => null);
    const conversation = payload?.tasks || [task];
    setMessages(conversation.flatMap((turn) => [
      { role: 'user', content: turn.prompt, filename: turn.filename },
      { role: 'ai', content: turn.aiTextResponse || (turn.status === 'cancelled' ? '任务已取消。' : '处理完成。'), error: turn.status === 'failed' },
    ]));
    setActiveTaskId(task._id);
    setActiveTab('workspace');
    if (task.outputFile || task.previewFile) {
      const version = new Date(task.runtime?.updatedAt || task.updatedAt).getTime();
      setActiveArtifact({
        filename: task.outputFilename,
        previewUrl: `/api/tasks/${task._id}/preview`,
        downloadUrl: task.outputFile ? `/api/tasks/${task._id}/download` : undefined,
        previewVersion: version,
      });
      lastPreviewVersionRef.current = version;
      setShowRightPanel(true);
      setSidebarCollapsed(true);
    } else {
      setActiveArtifact(null);
    }
  };

  const handleCancel = async () => {
    if (!activeTaskId) return;
    
    // Tell AionCore to stop generating via WebSocket
    cancelGeneration();

    // Still notify backend to mark DB status as cancelled
    const response = await fetch(`/api/tasks/${activeTaskId}/cancel`, { method: 'POST' });
    if (response.ok) {
      toast.success('正在停止任务…');
      setProcessLoading(false);
    } else {
      toast.error((await response.json().catch(() => ({}))).error || '停止失败');
    }
  };

  const handleProcess = async () => {
    if (!prompt.trim() || isGenerating) return;

    const currentPrompt = prompt;
    const currentFile = file;
    const parentTaskId = activeTaskId;
    
    // Optimistically add user message and an empty AI loading message
    const newMessages = [
      ...messages,
      { role: 'user', content: currentPrompt, filename: currentFile ? currentFile.name : null },
      { role: 'ai', content: '', loading: true }
    ];
    setMessages(newMessages);
    setPrompt('');
    setFile(null);
    setProcessLoading(true);

    try {
      // AionCore starts streaming as soon as /api/process returns. Ensure the
      // realtime channel is ready first so no start/content/finish event is lost.
      await waitUntilConnected();

      const formData = new FormData();
      if (currentFile) formData.append('file', currentFile);
      formData.append('prompt', currentPrompt);
      if (parentTaskId) formData.append('taskId', parentTaskId);

      const response = await fetch('/api/process', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const resData = await response.json().catch(() => ({}));
        throw new Error(resData.error || '处理失败');
      }

      const resData = await response.json();
      
      setActiveTaskId(resData.taskId);
      // Wait for React to apply activeTaskId before sending message,
      // or we can just pass the aionConversationId directly to sendMessage if we update the hook.
      // But loadConversation will be triggered by useEffect when activeTaskId changes.
      // Let's just pass the conversation ID explicitly or rely on the hook's current state.
      
      // Since useAioncoreChat is tied to a conversationId, we might need to load it first.
      loadConversation(resData.aionConversationId, resData.taskId, resData.aionWorkspace);
      
      // Now send the message through AionCore WebSocket
      sendMessage(currentPrompt, currentFile, resData.aionConversationId);
      
      fetchData(); // Update billing

    } catch (err) {
      toast.error('处理失败：' + err.message);
      setMessages(prev => {
        const next = [...prev];
        if (next.length > 0 && next[next.length - 1].role === 'ai') {
          next[next.length - 1] = { ...next[next.length - 1], content: '处理失败：' + err.message, loading: false, error: true };
        }
        return next;
      });
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isGenerating) handleProcess();
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
      <aside style={{ width: sidebarCollapsed ? '72px' : '280px', flexShrink: 0, background: '#f9f9f9', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', transition: 'width 0.25s ease' }}>
        {sidebarCollapsed ? (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 10px', gap: '10px' }}>
            <button onClick={startNewChat} title="开启新任务" style={{ width: '42px', height: '42px', borderRadius: '12px', border: '1px solid var(--border)', background: 'white', color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={20} /></button>
            <button onClick={() => setActiveTab('overview')} title="数据概览" style={{ width: '42px', height: '42px', borderRadius: '10px', border: 'none', background: activeTab === 'overview' ? 'var(--primary-light)' : 'transparent', color: activeTab === 'overview' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><LayoutDashboard size={19} /></button>
            <button onClick={() => setActiveTab('billing')} title="账单与流水" style={{ width: '42px', height: '42px', borderRadius: '10px', border: 'none', background: activeTab === 'billing' ? 'var(--primary-light)' : 'transparent', color: activeTab === 'billing' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CreditCard size={19} /></button>
            <div style={{ flex: 1 }} />
            <button onClick={() => setShowUserMenu(!showUserMenu)} title={user?.username || '用户'} style={{ width: '42px', height: '42px', borderRadius: '50%', border: 'none', background: 'linear-gradient(135deg, var(--primary) 0%, #6366f1 100%)', color: 'white', cursor: 'pointer', fontWeight: 700, fontSize: '1rem' }}>{user?.username?.[0]?.toUpperCase() || 'U'}</button>
          </div>
        ) : <>
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
        </>}
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        
        {/* Chat UI */}
        {activeTab === 'workspace' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'row', height: '100%', overflow: 'hidden' }}>
            
            {/* Left Column (Chat Area + Input) */}
            <div style={{ flex: showRightPanel ? '0 0 42%' : 1, minWidth: showRightPanel ? '360px' : 0, display: 'flex', flexDirection: 'column', height: '100%', transition: 'flex-basis 0.25s ease' }}>
            
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
                      {msg.thought && <Thinking thought={msg.thought} />}
                      {msg.progress && <TaskProgress progress={msg.progress} />}
                      {msg.loading && !msg.progress && !msg.thought && !msg.content ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
                          <Loader2 size={16} className="spin-anim" /> 思考中...
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                          <div className="markdown-body" style={{ lineHeight: '1.6', color: msg.error ? '#ef4444' : 'var(--text-main)' }}>
                          {msg.error ? (
                            <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                          ) : (
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                code({node, inline, className, children, ...props}) {
                                  const match = /language-(\w+)/.exec(className || '');
                                  const language = match ? match[1] : '';
                                  const codeText = String(children).replace(/\n$/, '');

                                  if (!inline && language) {
                                    return (
                                      <div style={{ margin: '16px 0', border: '1px solid var(--border)', borderRadius: '8px', overflowX: 'auto', maxWidth: '100%', background: 'transparent' }}>
                                          <SyntaxHighlighter
                                            {...props}
                                            style={oneLight}
                                            language={language}
                                            PreTag="div"
                                            customStyle={{ margin: 0, padding: '16px', fontSize: '0.9rem', borderRadius: 0, border: 'none' }}
                                          >
                                            {codeText}
                                          </SyntaxHighlighter>
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
                          {msg.loading && !msg.progress && msg.content && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                              <Loader2 size={14} className="spin-anim" /> 正在继续生成…
                            </div>
                          )}
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
                />
                
                {/* Upload Button */}
                <div style={{ position: 'absolute', left: '12px', bottom: '12px' }}>
                  <input type="file" id="file-upload" accept=".pdf,.xlsx,.xls,.csv,.docx,.pptx,.png,.jpg,.jpeg,.webp" onChange={handleFileChange} style={{ display: 'none' }} />
                  <label htmlFor="file-upload" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '50%', background: 'var(--background)', color: 'var(--text-muted)', transition: 'all 0.2s' }}>
                    <Paperclip size={18} />
                  </label>
                </div>

                {/* Send / Stop Button */}
                <button 
                  onClick={isGenerating ? handleCancel : handleProcess}
                  disabled={!isGenerating && !prompt.trim()}
                  title={isGenerating ? '停止生成' : '发送'}
                  style={{ position: 'absolute', right: '12px', bottom: '12px', minWidth: isGenerating ? '88px' : '32px', height: '32px', padding: isGenerating ? '0 11px' : 0, borderRadius: isGenerating ? '8px' : '50%', background: isGenerating ? '#ef4444' : prompt.trim() ? 'var(--primary)' : 'var(--background)', color: isGenerating || prompt.trim() ? 'white' : 'var(--text-muted)', border: 'none', cursor: isGenerating || prompt.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: isGenerating ? '6px' : 0, transition: 'all 0.2s', fontWeight: 600, fontSize: '0.8rem' }}
                >
                  {isGenerating ? <><StopCircle size={16} /> 停止生成</> : <Send size={16} style={{ marginLeft: '2px' }} />}
                </button>
              </div>
              <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                支持 PDF、Excel、Word、PPT 和常见图片。你可以连续发送多条指令在同一个文档上叠加操作。
              </div>
            </div>
          </div>

        {/* Right Panel: real OfficeCLI preview */}
        {showRightPanel && (
          <div style={{ flex: 1, minWidth: 0, background: 'white', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', animation: 'slideInRight 0.3s ease-out' }}>
            <div style={{ padding: '20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.2rem', margin: 0 }}>Office 真实预览</h3>
              <button onClick={() => { setShowRightPanel(false); setSidebarCollapsed(false); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }} title="关闭预览并展开左侧导航"><X size={20} /></button>
            </div>
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
              {activeArtifact && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
                  <iframe
                    key={activeArtifact.live ? activeArtifact.previewUrl : `${activeArtifact.previewUrl}:${activeArtifact.previewVersion || 0}`}
                    src={activeArtifact.live ? activeArtifact.previewUrl : `${activeArtifact.previewUrl}?v=${activeArtifact.previewVersion || 0}`}
                    title="Office document preview"
                    sandbox="allow-scripts allow-same-origin"
                    style={{ width: '100%', minHeight: '560px', flex: 1, border: '1px solid var(--border)', borderRadius: '8px', background: 'white' }}
                  />
                  {activeArtifact.downloadUrl && !aionIsProcessing && !processLoading ? (
                    <a href={activeArtifact.downloadUrl} className="btn btn-primary" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      下载
                    </a>
                  ) : <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>正在生成，预览会随 OfficeCLI 的渲染实时更新…</div>}
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
