'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { LayoutDashboard, CreditCard, Gift, LogOut, FileSpreadsheet, Activity, Clock, FileText, FileType2, ImageIcon, Sparkles, Zap, Plus, MessageSquare, Send, Paperclip, Loader2, Presentation, User, Settings, Crown, ChevronUp, X, Moon, Bell, Bot, FileJson, MoreVertical, Pin, PinOff, Edit2, Trash2, StopCircle, ArrowDown, Check, Copy, FolderOpen, Maximize2, Minimize2, UploadCloud } from 'lucide-react';
import { toast } from 'react-hot-toast';
import TaskProgress from '@/app/components/TaskProgress';
import Thinking from '@/app/components/Thinking';
import AionMessageTimeline from '@/app/components/AionMessageTimeline';
import WorkspaceBrowser from '@/app/components/WorkspaceBrowser';
import GenericFilePreview from '@/app/components/GenericFilePreview';
import ChatMarkdown from '@/app/components/ChatMarkdown';
import { useAioncoreChat } from '@/app/hooks/useAioncoreChat';
import ReferralCard from '@/app/components/ReferralCard';
import PhonePasswordForm from '@/app/components/PhonePasswordForm';
import { attachArtifactsToMessages, taskArtifactViews } from '@/lib/office/artifacts';
import { useI18n } from '@/app/i18n/I18nProvider';
import { dashboardCopy, dashboardExtra, dashboardOverviewCopy, dashboardSuggestions } from '@/app/i18n/dashboardCopy';
import { movedTowardHistory, resolveFollowLatest } from '@/lib/chat/scroll-policy';

function dashboardTabFromPath(pathname) {
  if (pathname?.endsWith('/referral')) return 'referral';
  if (pathname?.endsWith('/billing')) return 'billing';
  if (pathname?.endsWith('/overview')) return 'overview';
  return 'workspace';
}

function paginationItems(page, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  if (page <= 4) return [1, 2, 3, 4, 5, 'end-ellipsis', totalPages];
  if (page >= totalPages - 3) return [1, 'start-ellipsis', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  return [1, 'start-ellipsis', page - 1, page, page + 1, 'end-ellipsis', totalPages];
}

function timelineSummary(value, limit = 120) {
  const text = String(value || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*_`~\[\]()|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

// 逐字段浅比较两条消息是否等价。流式帧里 content/blocks 会被整体替换成新对象，
// 因此对这两个字段退化为序列化比较 —— 长度有限，代价可以接受。
// 聊天区占整行的百分比：默认 42%，往左可拖到只剩 360px，往右最多一半。
const DEFAULT_CHAT_WIDTH = 42;
const MAX_CHAT_WIDTH = 50;
const MIN_CHAT_PX = 360;

function shallowEqualMessage(left, right) {
  if (left === right) return true;
  if (!left || !right) return false;
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    const a = left[key];
    const b = right[key];
    if (a === b) continue;
    if (a && b && typeof a === 'object' && typeof b === 'object') {
      try {
        if (JSON.stringify(a) === JSON.stringify(b)) continue;
      } catch {
        return false;
      }
    }
    return false;
  }
  return true;
}

function formatBillingDateTime(value, locale) {
  const date = new Date(value);
  return {
    date: new Intl.DateTimeFormat(locale, { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date),
    time: new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(date),
  };
}

export default function DashboardClient() {
  const router = useRouter();
  const pathname = usePathname();
  const { locale, t } = useI18n();
  const copy = dashboardCopy(locale);
  const extra = dashboardExtra(locale);
  const overviewCopy = dashboardOverviewCopy(locale);
  const suggestionCopy = dashboardSuggestions(locale);
  const [activeTab, setActiveTab] = useState(() => dashboardTabFromPath(pathname));
  const [data, setData] = useState({ records: [], balance: 0 });
  const [stats, setStats] = useState({ totalFiles: 0, totalConversations: 0, totalConsumed: 0, totalTokens: 0, savedTimeHours: 0, completionRate: 0, statusCounts: {}, dailyActivity: [], artifactTypes: {}, averageTaskSeconds: 0, currentMonthTasks: 0, previousMonthTasks: 0, currentMonthCredits: 0, previousMonthCredits: 0, recentTasks: [] });
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [activeDrawer, setActiveDrawer] = useState(null); // 'profile' | 'settings' | 'membership' | 'recharge' | null
  const [showRightPanel, setShowRightPanel] = useState(false);
  const [chatWidth, setChatWidth] = useState(DEFAULT_CHAT_WIDTH);
  const [resizingSplit, setResizingSplit] = useState(false);
  const splitRowRef = useRef(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeArtifact, setActiveArtifact] = useState(null);
  const [previewTabs, setPreviewTabs] = useState([]);
  const [rightPanelMode, setRightPanelMode] = useState('preview');
  const [followLatest, setFollowLatest] = useState(true);
  const [copiedMessageIndex, setCopiedMessageIndex] = useState(null);
  const [previewError, setPreviewError] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewFullscreen, setPreviewFullscreen] = useState(false);
  const [redeemCode, setRedeemCode] = useState('');
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [billingPagination, setBillingPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [billingLoading, setBillingLoading] = useState(false);
  const [rechargeAmountYuan, setRechargeAmountYuan] = useState(50);
  const [wechatPayment, setWechatPayment] = useState(null);
  const [wechatPaymentLoading, setWechatPaymentLoading] = useState(false);
  const [plans, setPlans] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [selectedPlanId, setSelectedPlanId] = useState('PRO');
  const [selectedPeriodMonths, setSelectedPeriodMonths] = useState(1);
  const [subscribeLoading, setSubscribeLoading] = useState(false);
  const [creditPrompt, setCreditPrompt] = useState(null);
  const activeArtifactId = activeArtifact?.id;
  const activeArtifactUrl = activeArtifact?.previewUrl;
  const activeArtifactGeneric = Boolean(activeArtifact?.generic);

  useEffect(() => {
    setPreviewError('');
    setPreviewLoading(Boolean(activeArtifactId && !activeArtifactGeneric));
  }, [activeArtifactGeneric, activeArtifactId, activeArtifactUrl]);

  const navigateToTab = (tab) => {
    const routes = { workspace: '/dashboard', overview: '/dashboard/overview', billing: '/dashboard/billing', referral: '/dashboard/referral' };
    const nextPath = routes[tab];
    if (nextPath && nextPath !== window.location.pathname) {
      setActiveTab(tab);
      router.push(nextPath, { scroll: false });
    }
  };

  useEffect(() => {
    const tab = dashboardTabFromPath(pathname);
    setActiveTab(tab);
  }, [pathname]);

  useEffect(() => {
    const syncHistoryTab = () => {
      const tab = dashboardTabFromPath(window.location.pathname);
      setActiveTab(tab);
    };
    window.addEventListener('popstate', syncHistoryTab, true);
    return () => window.removeEventListener('popstate', syncHistoryTab, true);
  }, []);

  // AionCore hook
  const { messages: aionMessages, officeArtifact, isProcessing: aionIsProcessing, sendMessage, loadConversation, waitUntilConnected, cancelGeneration } = useAioncoreChat();

  // Chat UI states
  const [messages, setMessages] = useState([]);
  const [prompt, setPrompt] = useState('');
  const [files, setFiles] = useState([]);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const fileDragDepthRef = useRef(0);
  const [hoveredConversationTurn, setHoveredConversationTurn] = useState(null);
  const [activeConversationTurn, setActiveConversationTurn] = useState(0);
  const [processLoading, setProcessLoading] = useState(false);
  const isGenerating = processLoading || aionIsProcessing;
  const [activeTaskId, setActiveTaskId] = useState(null); // Tracks the current conversational thread context
  const messagesEndRef = useRef(null);
  const artifactRefs = useRef(new Map());
  const conversationTurnRefs = useRef(new Map());
  const autoOpenedArtifactRef = useRef(new Set());
  const activeConversationTurnRef = useRef(0);
  const promptInputRef = useRef(null);
  const chatScrollRef = useRef(null);
  const followLatestRef = useRef(true);
  const lastChatScrollTopRef = useRef(0);
  const conversationJumpingRef = useRef(false);
  const previewPanelRef = useRef(null);
  
  const [openMenuId, setOpenMenuId] = useState(null);
  const [renamingTaskId, setRenamingTaskId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState({ isOpen: false, taskId: null });
  const menuRef = useRef(null);
  const cancellingRef = useRef(false);
  const generationObservedRef = useRef(false);

  const resizePromptInput = useCallback((element) => {
    if (!element) return;
    element.style.height = '40px';
    const nextHeight = Math.min(200, Math.max(40, element.scrollHeight));
    element.style.height = `${nextHeight}px`;
    element.style.overflowY = element.scrollHeight > 200 ? 'auto' : 'hidden';
  }, []);

  useEffect(() => {
    resizePromptInput(promptInputRef.current);
  }, [prompt, resizePromptInput]);

  // 流式正文在渲染期派生，不再由 effect 回写 messages。
  // 以前每来一帧就 setMessages 一次，而滚动 effect 又依赖 messages，
  // 于是「passive effect 里发起更新 -> 提交 -> 又有 passive effect 待执行」这条环
  // 一直不断，React 的 nested passive update 计数归不了零，
  // 一轮生成上百帧，到第 50 帧就抛 Maximum update depth exceeded。
  const renderMessages = useMemo(() => {
    const lastAionMsg = aionMessages?.length ? aionMessages[aionMessages.length - 1] : null;
    if (!lastAionMsg || lastAionMsg.role !== 'ai') return messages;
    const last = messages.length ? messages[messages.length - 1] : null;
    if (!last || last.role !== 'ai') return [...messages, { ...lastAionMsg, loading: aionIsProcessing }];
    const merged = { ...last, ...lastAionMsg, artifacts: last.artifacts, loading: aionIsProcessing };
    if (shallowEqualMessage(last, merged)) return messages;
    const next = [...messages];
    next[next.length - 1] = merged;
    return next;
  }, [messages, aionMessages, aionIsProcessing]);

  const conversationTimeline = renderMessages.reduce((turns, message, messageIndex) => {
    if (message.role !== 'user') return turns;
    const reply = renderMessages.slice(messageIndex + 1).find((candidate) => candidate.role === 'ai');
    turns.push({
      messageIndex,
      question: timelineSummary(message.content, 80) || '新对话',
      reply: timelineSummary(reply?.content, 140) || (reply?.loading ? '正在回复…' : '暂无回复'),
    });
    return turns;
  }, []);

  const beginSplitDrag = useCallback((event) => {
    const row = splitRowRef.current;
    if (!row) return;
    event.preventDefault();
    setResizingSplit(true);
    const move = (moveEvent) => {
      const rect = row.getBoundingClientRect();
      if (!rect.width) return;
      // 下限用像素换算，窄屏上才不会把聊天区压到比 minWidth 还小、
      // 出现「拖了但纹丝不动」的手感。
      const minPercent = Math.min(MAX_CHAT_WIDTH, (MIN_CHAT_PX / rect.width) * 100);
      const percent = ((moveEvent.clientX - rect.left) / rect.width) * 100;
      setChatWidth(Math.min(MAX_CHAT_WIDTH, Math.max(minPercent, percent)));
    };
    const stop = () => {
      setResizingSplit(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
  }, []);

  const openArtifact = useCallback((artifact) => {
    if (!artifact) return;
    // 同一个文件可能从消息卡片、生成事件和文件工作区以不同 artifact id
    // 抵达前端。预览标签按「任务 + 文件名」归一，避免同一文件重复打开。
    const identity = `${artifact.taskId || activeTaskId || ''}:${String(artifact.filename || '').trim().toLowerCase()}`;
    const canonical = { ...artifact, id: `preview:${identity}` };
    setPreviewTabs((current) => current.some((item) => item.id === canonical.id)
      ? current.map((item) => item.id === canonical.id ? { ...item, ...canonical } : item)
      : [...current, canonical]);
    setActiveArtifact(canonical);
    setPreviewError('');
    setRightPanelMode('preview');
    setShowRightPanel(true);
    setSidebarCollapsed(true);
  }, [activeTaskId]);

  // 把任务的附件转成预览面板认识的产物描述。
  // 聊天气泡里的文件按钮一直写着 onClick={() => openArtifact(msg.attachments[index])}，
  // 但三处构造消息的地方都只填了 filenames、没填 attachments，
  // 于是 disabled 恒为 true —— 点了没反应。后端其实早就支持按下标预览附件。
  const attachmentArtifacts = useCallback((taskId, attachments) => {
    if (!taskId || !Array.isArray(attachments)) return [];
    return attachments.map((attachment, index) => {
      const filename = attachment?.filename || `附件 ${index + 1}`;
      const extension = filename.includes('.') ? filename.split('.').pop().toLowerCase() : '';
      // Office 文档走实时预览引擎，其余类型交给通用预览
      const office = ['docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt'].includes(extension);
      return {
        id: `${taskId}:attachment-${index}`,
        taskId,
        filename,
        fileType: extension,
        previewType: extension,
        status: 'ready',
        generic: !office,
        previewUrl: `/api/tasks/${taskId}/office-preview/proxy/attachment-${index}/`,
        downloadUrl: `/api/tasks/${taskId}/download?attachmentIndex=${index}`,
      };
    });
  }, []);

  const openWorkspaceFile = useCallback((workspaceFile) => {
    const encodedPath = encodeURIComponent(workspaceFile.path);
    const officeArtifact = workspaceFile.artifactId ? {
      id: `${activeTaskId}:${workspaceFile.artifactId}`, taskId: activeTaskId, artifactId: workspaceFile.artifactId,
      filename: workspaceFile.name, fileType: workspaceFile.previewType, status: workspaceFile.status || 'ready', live: true,
      previewUrl: `/api/tasks/${activeTaskId}/office-preview/proxy/${workspaceFile.artifactId}/`,
      downloadUrl: `/api/tasks/${activeTaskId}/download?artifactId=${encodeURIComponent(workspaceFile.artifactId)}`,
    } : {
      id: `${activeTaskId}:workspace:${workspaceFile.path}`, taskId: activeTaskId, filename: workspaceFile.name,
      fileType: workspaceFile.previewType, previewType: workspaceFile.previewType, status: 'ready', generic: true,
      previewUrl: `/api/tasks/${activeTaskId}/workspace/file?path=${encodedPath}`,
      downloadUrl: `/api/tasks/${activeTaskId}/workspace/file?path=${encodedPath}&download=1`,
    };
    openArtifact(officeArtifact);
  }, [activeTaskId, openArtifact]);

  const togglePreviewFullscreen = useCallback(async () => {
    const panel = previewPanelRef.current;
    if (!panel) return;

    try {
      if (document.fullscreenElement === panel) {
        await document.exitFullscreen();
      } else {
        await panel.requestFullscreen();
      }
    } catch {
      toast.error('浏览器无法进入全屏预览');
    }
  }, []);

  const closePreviewPanel = useCallback(() => {
    if (document.fullscreenElement === previewPanelRef.current) {
      void document.exitFullscreen();
    }
    setShowRightPanel(false);
    setSidebarCollapsed(false);
  }, []);

  const closeArtifact = useCallback((artifactId) => {
    setPreviewTabs((current) => {
      const index = current.findIndex((item) => item.id === artifactId);
      const next = current.filter((item) => item.id !== artifactId);
      setActiveArtifact((active) => active?.id === artifactId ? (next[Math.min(index, next.length - 1)] || null) : active);
      if (!next.length) {
        if (document.fullscreenElement === previewPanelRef.current) void document.exitFullscreen();
        setShowRightPanel(false);
        setSidebarCollapsed(false);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const syncFullscreenState = () => {
      setPreviewFullscreen(document.fullscreenElement === previewPanelRef.current);
    };
    document.addEventListener('fullscreenchange', syncFullscreenState);
    return () => document.removeEventListener('fullscreenchange', syncFullscreenState);
  }, []);

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
          router.replace('/dashboard', { scroll: false });
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
        {
          role: 'user',
          content: task.prompt,
          filename: task.filename,
          filenames: task.attachments?.length
            ? task.attachments.map((attachment) => attachment.filename)
            : task.filename ? [task.filename] : [],
          attachments: attachmentArtifacts(task._id, task.attachments),
        },
        {
          role: 'ai', content: task.runtime?.streamedText || '', loading: true,
          thought: task.runtime?.thought?.description ? task.runtime.thought : undefined,
          progress: runtimeProgress ? { subject: runtimeProgress.title || extra.processing, startedAt: new Date(task.createdAt).getTime(), steps: [runtimeProgress] } : undefined,
        },
      ]);
      const artifacts = taskArtifactViews(task);
      if (artifacts.length && task.runtime?.progress?.type === 'preview') openArtifact(artifacts.at(-1));
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [openArtifact]);

  useEffect(() => {
    // 生成过程中一律不落库：显示交给上面的 renderMessages 派生。
    // 只在一轮结束时把最终结果写进 messages，好让下一轮继续在它后面累积，
    // 这样每轮只有一次 setState，而不是每帧一次。
    if (aionIsProcessing) return;
    const lastAionMsg = aionMessages?.length ? aionMessages[aionMessages.length - 1] : null;
    if (!lastAionMsg || lastAionMsg.role !== 'ai') return;
    setMessages((prev) => {
      const last = prev.length ? prev[prev.length - 1] : null;
      if (!last || last.role !== 'ai') return [...prev, { ...lastAionMsg, loading: false }];
      const merged = { ...last, ...lastAionMsg, artifacts: last.artifacts, loading: false };
      if (shallowEqualMessage(last, merged)) return prev;
      const next = [...prev];
      next[next.length - 1] = merged;
      return next;
    });
  }, [aionMessages, aionIsProcessing]);

  useEffect(() => {
    if (!officeArtifact) return;
    const artifact = officeArtifact.id ? officeArtifact : {
      ...officeArtifact,
      id: `${officeArtifact.taskId || activeTaskId}:${officeArtifact.artifactId || officeArtifact.filename}`,
    };
    autoOpenedArtifactRef.current.add(artifact.id);
    setMessages((current) => {
      const next = [...current];
      const index = next.findLastIndex((message) => message.role === 'ai');
      if (index >= 0) {
        const artifacts = next[index].artifacts || [];
        next[index] = { ...next[index], artifacts: artifacts.some((item) => item.id === artifact.id)
          ? artifacts.map((item) => item.id === artifact.id ? { ...item, ...artifact } : item)
          : [...artifacts, artifact] };
      }
      return next;
    });
    openArtifact(artifact);
  }, [officeArtifact, activeTaskId, openArtifact]);

  useEffect(() => {
    if (!activeTaskId || !processLoading) return;
    let disposed = false;
    const pollArtifacts = async () => {
      try {
        const response = await fetch(`/api/tasks/${activeTaskId}/artifacts`, { cache: 'no-store' });
        const payload = await response.json();
        if (!response.ok || disposed || !payload.artifacts?.length) return;
        setMessages((current) => {
          const next = [...current];
          const index = next.findLastIndex((message) => message.role === 'ai');
          if (index < 0) return current;
          next[index] = { ...next[index], artifacts: payload.artifacts };
          return next;
        });
        const unseen = payload.artifacts.find((artifact) => !autoOpenedArtifactRef.current.has(artifact.id));
        if (unseen) {
          autoOpenedArtifactRef.current.add(unseen.id);
          openArtifact(unseen);
        }
      } catch {
        // Realtime preview remains the primary path; polling is a resilient fallback.
      }
    };
    void pollArtifacts();
    const timer = window.setInterval(pollArtifacts, 1500);
    return () => { disposed = true; window.clearInterval(timer); };
  }, [activeTaskId, processLoading, openArtifact]);

  useEffect(() => {
    // Sync completion status back to MongoDB when aioncore finishes generating
    if (aionIsProcessing) {
      generationObservedRef.current = true;
      return;
    }
    if (!generationObservedRef.current) return;
    if (processLoading && !cancellingRef.current && activeTaskId && renderMessages.length > 0) {
      const lastMsg = renderMessages[renderMessages.length - 1];
      if (lastMsg && lastMsg.role === 'ai') {
        fetch(`/api/tasks/${activeTaskId}/finish`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: lastMsg.content })
        }).then(async (response) => {
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.error || 'Failed to sync finish state');
          if (!payload.artifacts?.length) return;
          setMessages((current) => {
            const next = [...current];
            const index = next.findLastIndex((message) => message.role === 'ai');
            if (index >= 0) next[index] = { ...next[index], artifacts: payload.artifacts };
            return next;
          });
          openArtifact(payload.artifacts.at(-1));
        }).catch(e => console.error('Failed to sync finish state', e));
        generationObservedRef.current = false;
        setProcessLoading(false);
      }
    }
  }, [aionIsProcessing, processLoading, activeTaskId, renderMessages, openArtifact]);

  useEffect(() => {
    if (!followLatest || !chatScrollRef.current) return;
    const frame = window.requestAnimationFrame(() => {
      const element = chatScrollRef.current;
      if (!element) return;
      if (isGenerating) element.scrollTop = element.scrollHeight;
      else element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [renderMessages, followLatest, isGenerating]);

  const handleChatScroll = useCallback((event) => {
    const element = event.currentTarget;
    const movedUp = movedTowardHistory(lastChatScrollTopRef.current, element.scrollTop);
    lastChatScrollTopRef.current = element.scrollTop;
    const viewportTop = element.getBoundingClientRect().top;
    let nearestTurn = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    conversationTurnRefs.current.forEach((turnElement, turnIndex) => {
      const distance = Math.abs(turnElement.getBoundingClientRect().top - viewportTop - 72);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestTurn = turnIndex;
      }
    });
    if (activeConversationTurnRef.current !== nearestTurn) {
      activeConversationTurnRef.current = nearestTurn;
      setActiveConversationTurn(nearestTurn);
    }
    if (conversationJumpingRef.current) return;
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    const nextFollowLatest = resolveFollowLatest({
      following: followLatestRef.current,
      distanceFromBottom,
      movedTowardHistory: movedUp,
    });
    if (nextFollowLatest === followLatestRef.current) return;
    followLatestRef.current = nextFollowLatest;
    setFollowLatest(nextFollowLatest);
  }, []);

  const pauseFollowLatest = useCallback(() => {
    if (!followLatestRef.current) return;
    followLatestRef.current = false;
    setFollowLatest(false);
  }, []);

  const jumpToLatest = useCallback(() => {
    followLatestRef.current = true;
    setFollowLatest(true);
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const copyMessage = useCallback(async (content, index) => {
    await navigator.clipboard.writeText(content || '');
    setCopiedMessageIndex(index);
    window.setTimeout(() => setCopiedMessageIndex((current) => current === index ? null : current), 1500);
  }, []);

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

      if (billingJson.success) {
        setData({ records: billingJson.records, balance: billingJson.balance });
        if (billingJson.pagination) setBillingPagination(billingJson.pagination);
      }
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

  const fetchBillingPage = async (page) => {
    setBillingLoading(true);
    try {
      const response = await fetch(`/api/user/billing?page=${page}&pageSize=${billingPagination.pageSize}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || '账单加载失败');
      setData((current) => ({ ...current, records: payload.records, balance: payload.balance }));
      setBillingPagination(payload.pagination);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBillingLoading(false);
    }
  };

  const handleWechatRecharge = async () => {
    setWechatPaymentLoading(true);
    try {
      const response = await fetch('/api/user/billing/wechat/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amountYuan: rechargeAmountYuan }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || '微信支付下单失败');
      setWechatPayment({ id: payload.orderId, status: 'paying', ...payload });
    } catch (error) {
      toast.error(error.message);
    } finally {
      setWechatPaymentLoading(false);
    }
  };

  const refreshSubscription = useCallback(async () => {
    const response = await fetch('/api/user/subscription');
    const payload = await response.json().catch(() => ({}));
    if (payload?.success) setSubscription(payload.subscription);
  }, []);

  // 套餐目录只在打开会员弹窗时拉取，避免拖慢工作台首屏。
  useEffect(() => {
    if (activeDrawer !== 'membership' || plans.length) return;
    void (async () => {
      const response = await fetch('/api/billing/plans');
      const payload = await response.json().catch(() => ({}));
      if (!payload?.success) return;
      setPlans(payload.plans);
      if (payload.plans[0]) setSelectedPlanId((current) => payload.plans.some((plan) => plan.id === current) ? current : payload.plans[0].id);
    })();
  }, [activeDrawer, plans.length]);

  // 订阅状态在账单页、会员弹窗和左下角会员信息中展示。
  useEffect(() => {
    if (activeTab !== 'billing' && activeDrawer !== 'membership') return;
    void refreshSubscription();
  }, [activeTab, activeDrawer, refreshSubscription]);

  const handleSubscribe = async () => {
    setSubscribeLoading(true);
    try {
      const response = await fetch('/api/user/subscription/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: selectedPlanId, periodMonths: selectedPeriodMonths }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || '订阅下单失败');
      setWechatPayment({ id: payload.orderId, status: 'paying', purpose: 'subscription', ...payload });
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSubscribeLoading(false);
    }
  };

  const handleToggleAutoRenew = async (resume) => {
    try {
      const response = await fetch('/api/user/subscription/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resume }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || '操作失败');
      toast.success(payload.message);
      await refreshSubscription();
    } catch (error) {
      toast.error(error.message);
    }
  };

  useEffect(() => {
    if (!wechatPayment?.id || wechatPayment.status !== 'paying') return undefined;
    const poll = window.setInterval(async () => {
      const response = await fetch(`/api/user/billing/wechat/orders/${wechatPayment.id}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.order) return;
      setWechatPayment((current) => current?.id === wechatPayment.id ? { ...current, ...payload.order } : current);
      if (payload.order.status === 'paid') {
        const paidPurpose = payload.order.purpose;
        setWechatPayment(null);
        setActiveDrawer(null);
        void fetch('/api/user/billing?page=1&pageSize=20').then((billingResponse) => billingResponse.json()).then((billingPayload) => {
          if (!billingPayload.success) return;
          setData({ records: billingPayload.records, balance: billingPayload.balance });
          setBillingPagination(billingPayload.pagination);
          if (billingPayload.balance > 0) setCreditPrompt(null);
        });
        if (paidPurpose === 'subscription') {
          void refreshSubscription();
          // 会员等级变了，顶部头像旁的等级徽章需要跟着刷新。
          void fetch('/api/auth/me').then((meResponse) => meResponse.json()).then((mePayload) => {
            if (mePayload?.user) setUser(mePayload.user);
          }).catch(() => undefined);
        }
        toast.success(paidPurpose === 'subscription'
          ? `会员已开通，赠送 ${payload.order.credits.toLocaleString()} Credits 已到账`
          : `充值成功，已到账 ${payload.order.credits.toLocaleString()} Credits`);
      }
    }, 2500);
    return () => window.clearInterval(poll);
  }, [wechatPayment?.id, wechatPayment?.status, refreshSubscription]);

  const handlePaymentComplete = async () => {
    const purpose = wechatPayment?.purpose;
    try {
      await fetchData();
      if (purpose === 'subscription') await refreshSubscription();
    } finally {
      setWechatPayment(null);
      setActiveDrawer(null);
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
        toast.success(`兑换成功！增加 ${dataJson.amount} Credits。`);
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

  const addFiles = useCallback((incomingFiles) => {
    const allowedExtensions = new Set(['pdf', 'xlsx', 'xls', 'csv', 'docx', 'pptx', 'png', 'jpg', 'jpeg', 'webp']);
    const selected = Array.from(incomingFiles || []).filter((file) => {
      const extension = file.name.split('.').pop()?.toLowerCase();
      return extension && allowedExtensions.has(extension);
    });
    if (selected.length !== Array.from(incomingFiles || []).length) toast.error('部分文件格式不受支持');
    if (!selected.length) return;
    setFiles((current) => {
      const unique = [...current];
      for (const candidate of selected) {
        if (!unique.some((item) => item.name === candidate.name && item.size === candidate.size && item.lastModified === candidate.lastModified)) unique.push(candidate);
      }
      if (unique.length > 10) toast.error('每次最多上传 10 个文件');
      const limited = unique.slice(0, 10);
      if (limited.reduce((total, item) => total + item.size, 0) > 100 * 1024 * 1024) {
        toast.error('文件总大小不能超过 100MB');
        return current;
      }
      return limited;
    });
  }, []);

  const jumpToConversationTurn = useCallback((turnIndex) => {
    conversationJumpingRef.current = true;
    followLatestRef.current = false;
    setFollowLatest(false);
    if (activeConversationTurnRef.current !== turnIndex) {
      activeConversationTurnRef.current = turnIndex;
      setActiveConversationTurn(turnIndex);
    }
    conversationTurnRefs.current.get(turnIndex)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => {
      conversationJumpingRef.current = false;
    }, 700);
  }, []);

  const handleFileChange = (e) => {
    addFiles(e.target.files);
    e.target.value = '';
  };

  const hasDraggedFiles = (event) => Array.from(event.dataTransfer?.types || []).includes('Files');

  const handleFileDragEnter = (event) => {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    fileDragDepthRef.current += 1;
    setIsDraggingFiles(true);
  };

  const handleFileDragOver = (event) => {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setIsDraggingFiles(true);
  };

  const handleFileDrop = (event) => {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    fileDragDepthRef.current = 0;
    setIsDraggingFiles(false);
    addFiles(event.dataTransfer.files);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    fileDragDepthRef.current = Math.max(0, fileDragDepthRef.current - 1);
    if (fileDragDepthRef.current === 0) setIsDraggingFiles(false);
  };

  const startNewChat = () => {
    setMessages([]);
    setFiles([]);
    setPrompt('');
    setActiveTaskId(null);
    navigateToTab('workspace');
    setShowRightPanel(false);
    setSidebarCollapsed(false);
    setActiveArtifact(null);
    setPreviewTabs([]);
  };

  const loadHistoryTask = useCallback(async (task, { navigate = true } = {}) => {
    setActiveTaskId(task._id);
    if (navigate && window.location.pathname !== '/dashboard') {
      setActiveTab('workspace');
      router.push('/dashboard', { scroll: false });
    }
    setMessages([{ role: 'ai', content: '', loading: true }]);
    const payload = await fetch(`/api/tasks/${task._id}/conversation`).then((res) => res.json()).catch(() => null);
    const conversation = payload?.tasks || [task];
    const persistedMessages = conversation.flatMap((turn) => [
      // 附件预览按任务维度定位，因此用这一轮自己的 turn._id，而不是整条会话的根任务 id
      { role: 'user', content: turn.prompt, filename: turn.filename, filenames: turn.attachments?.length ? turn.attachments.map((item) => item.filename) : turn.filename ? [turn.filename] : [], attachments: attachmentArtifacts(turn._id, turn.attachments) },
      {
        role: 'ai',
        content: turn.aiTextResponse || turn.runtime?.streamedText || (turn.status === 'cancelled'
          ? '任务已取消。'
          : turn.status === 'failed'
            ? `处理失败：${turn.errorMessage || '未记录错误详情'}`
            : turn.status === 'processing'
              ? '任务仍在处理中，正在恢复实时状态…'
              : '这条历史回复未能写入任务数据库。'),
        error: turn.status === 'failed',
      },
    ]);
    const historyMessages = payload?.messages?.length ? payload.messages : persistedMessages;
    setMessages(attachArtifactsToMessages(historyMessages, conversation));
    if (task.aionConversationId) loadConversation(task.aionConversationId, task._id, '', { loadHistory: false });
    setPreviewTabs([]);
    setActiveArtifact(null);
    setShowRightPanel(false);
    setSidebarCollapsed(false);
  }, [attachmentArtifacts, loadConversation, router]);

  const handleCancel = async () => {
    if (!activeTaskId) return;
    cancellingRef.current = true;
    try {
      await cancelGeneration();
      const response = await fetch(`/api/tasks/${activeTaskId}/cancel`, { method: 'POST' });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || '任务状态更新失败');
      toast.success('任务已停止');
      setProcessLoading(false);
    } catch (error) {
      toast.error(error.message || '停止失败');
    } finally {
      cancellingRef.current = false;
    }
  };

  const handleProcess = async () => {
    if (!prompt.trim() || isGenerating) return;

    const currentPrompt = prompt;
    const currentFiles = files;
    const parentTaskId = activeTaskId;
    const requestStartedAt = Date.now();
    
    // Optimistically add user message and an empty AI loading message
    const newMessages = [
      ...renderMessages,
      { role: 'user', content: currentPrompt, filename: currentFiles[0]?.name || null, filenames: currentFiles.map((item) => item.name) },
      { role: 'ai', content: '', loading: true }
    ];
    setMessages(newMessages);
    setPrompt('');
    setFiles([]);
    generationObservedRef.current = false;
    followLatestRef.current = true;
    setFollowLatest(true);
    setProcessLoading(true);

    try {
      // AionCore starts streaming as soon as /api/process returns. Ensure the
      // realtime channel is ready first so no start/content/finish event is lost.
      await waitUntilConnected();
      console.info('[OfficeWeb:Generation] realtime ready', { elapsedMs: Date.now() - requestStartedAt });

      const formData = new FormData();
      for (const currentFile of currentFiles) formData.append('files', currentFile);
      formData.append('prompt', currentPrompt);
      if (parentTaskId) formData.append('taskId', parentTaskId);

      console.info('[OfficeWeb:Generation] process request started', { fileCount: currentFiles.length, continuation: Boolean(parentTaskId) });
      const response = await fetch('/api/process', {
        method: 'POST',
        body: formData,
      });
      console.info('[OfficeWeb:Generation] process response received', { status: response.status, elapsedMs: Date.now() - requestStartedAt });

      if (!response.ok) {
        const resData = await response.json().catch(() => ({}));
        if (resData.code === 'PHONE_REQUIRED') {
          toast.error('请使用手机号验证码重新登录');
          router.push('/login');
        }
        if (response.status === 403 && String(resData.error || '').includes('余额不足')) {
          setCreditPrompt({ message: resData.error || '当前 Credits 不足，暂时无法执行该任务。' });
        }
        throw new Error(resData.error || '处理失败');
      }

      const resData = await response.json();
      setCreditPrompt(null);
      
      setActiveTaskId(resData.taskId);

      // 发送那一刻任务还没创建，拿不到 taskId，附件描述只能等这里回填 ——
      // 补上之后刚发出去的那条消息里的文件也能点开预览，不必等刷新。
      if (currentFiles.length) {
        const artifacts = attachmentArtifacts(resData.taskId, currentFiles.map((item) => ({ filename: item.name })));
        setMessages((current) => {
          const index = current.findLastIndex((message) => message.role === 'user');
          if (index < 0) return current;
          const next = [...current];
          next[index] = { ...next[index], attachments: artifacts };
          return next;
        });
      }
      // Wait for React to apply activeTaskId before sending message,
      // or we can just pass the aionConversationId directly to sendMessage if we update the hook.
      // But loadConversation will be triggered by useEffect when activeTaskId changes.
      // Let's just pass the conversation ID explicitly or rely on the hook's current state.
      
      // Since useAioncoreChat is tied to a conversationId, we might need to load it first.
      loadConversation(resData.aionConversationId, resData.taskId, resData.aionWorkspace);
      
      // Now send the message through AionCore WebSocket
      sendMessage(currentPrompt, currentFiles, resData.aionConversationId);
      
      fetchData(); // Update billing

    } catch (err) {
      console.error('[OfficeWeb:Generation] process failed', { message: err.message, elapsedMs: Date.now() - requestStartedAt });
      generationObservedRef.current = false;
      setProcessLoading(false);
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

  if (loading) return <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>{copy.loading}</div>;

  const isProMember = Boolean(subscription || user?.membershipLevel === 'PRO');

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 73px)', background: 'var(--background)', overflow: 'hidden' }}>
      
      {/* Sidebar - ChatGPT Style */}
      <aside style={{ width: sidebarCollapsed ? '72px' : '280px', flexShrink: 0, background: '#f9f9f9', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', transition: 'width 0.25s ease' }}>
        {sidebarCollapsed ? (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 10px', gap: '10px' }}>
            <button onClick={startNewChat} title={t('dashboard.newChat')} style={{ width: '42px', height: '42px', borderRadius: '12px', border: '1px solid var(--border)', background: 'white', color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={20} /></button>
            <button onClick={() => navigateToTab('overview')} title={t('dashboard.overview')} style={{ width: '42px', height: '42px', borderRadius: '10px', border: 'none', background: activeTab === 'overview' ? 'var(--primary-light)' : 'transparent', color: activeTab === 'overview' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><LayoutDashboard size={19} /></button>
            <button onClick={() => navigateToTab('billing')} title={t('dashboard.billing')} style={{ width: '42px', height: '42px', borderRadius: '10px', border: 'none', background: activeTab === 'billing' ? 'var(--primary-light)' : 'transparent', color: activeTab === 'billing' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CreditCard size={19} /></button>
            <button onClick={() => navigateToTab('referral')} title={t('dashboard.referral')} style={{ width: '42px', height: '42px', borderRadius: '10px', border: 'none', background: activeTab === 'referral' ? 'var(--primary-light)' : 'transparent', color: activeTab === 'referral' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Gift size={19} /></button>
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
            <span>{t('dashboard.newChat')}</span>
          </button>
        </div>

        <nav style={{ padding: '0 16px 16px 16px', display: 'flex', flexDirection: 'column', gap: '4px', borderBottom: '1px solid var(--border)' }}>
          <button onClick={() => navigateToTab('overview')} className="admin-nav-link" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', borderRadius: 'var(--radius-md)', color: activeTab === 'overview' ? 'var(--primary)' : 'var(--text-main)', background: activeTab === 'overview' ? 'var(--primary-light)' : 'transparent', textDecoration: 'none', fontWeight: 500, border: 'none', cursor: 'pointer', textAlign: 'left' }}>
            <LayoutDashboard size={18} /> {t('dashboard.overview')}
          </button>
          <button onClick={() => navigateToTab('billing')} className="admin-nav-link" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', borderRadius: 'var(--radius-md)', color: activeTab === 'billing' ? 'var(--primary)' : 'var(--text-main)', background: activeTab === 'billing' ? 'var(--primary-light)' : 'transparent', textDecoration: 'none', fontWeight: 500, border: 'none', cursor: 'pointer', textAlign: 'left' }}>
            <CreditCard size={18} /> {t('dashboard.billing')}
          </button>
          <button onClick={() => navigateToTab('referral')} className="admin-nav-link" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', borderRadius: 'var(--radius-md)', color: activeTab === 'referral' ? 'var(--primary)' : 'var(--text-main)', background: activeTab === 'referral' ? 'var(--primary-light)' : 'transparent', textDecoration: 'none', fontWeight: 500, border: 'none', cursor: 'pointer', textAlign: 'left' }}>
            <Gift size={18} /> {t('dashboard.referral')}
          </button>
        </nav>
        
        {/* History List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('dashboard.recent')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {stats.recentTasks && stats.recentTasks.length === 0 && (
              <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>{copy.noRecords}</div>
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
                    title={t.isPinned ? copy.unpin : copy.pin}
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
                          <Edit2 size={14} /> {copy.rename}
                        </button>
                        <button 
                          onClick={(e) => handleDeleteTask(e, t._id)}
                          style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 12px', background: 'transparent', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem', color: '#ef4444', textAlign: 'left' }}
                          onMouseOver={e=>e.currentTarget.style.background='#fee2e2'}
                          onMouseOut={e=>e.currentTarget.style.background='transparent'}
                        >
                          <Trash2 size={14} /> {copy.delete}
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
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>{copy.currentPlan}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
                  <Crown size={16} color={isProMember ? 'var(--primary)' : '#d97706'} />
                  {isProMember ? '专业版' : '免费版'}
                  {!isProMember && <span style={{ marginLeft: 'auto', color: 'var(--primary)', fontSize: '0.78rem' }}>升级</span>}
                </div>
                {subscription && <div style={{ marginTop: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>有效期至 {new Date(subscription.currentPeriodEnd).toLocaleDateString('zh-CN')}</div>}
              </div>

              <div style={{ padding: '8px' }}>
                <button 
                  onClick={() => { setWechatPayment(null); setActiveDrawer('membership'); setShowUserMenu(false); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', width: '100%', background: 'transparent', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', textAlign: 'left', transition: 'background 0.2s' }}
                  onMouseOver={e => e.currentTarget.style.background = 'var(--background)'}
                  onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                >
                  <Crown size={16} color="var(--primary)" /> {isProMember ? '会员详情与续费' : copy.upgrade}
                </button>
                <button 
                  onClick={() => { setActiveDrawer('profile'); setShowUserMenu(false); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', width: '100%', background: 'transparent', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', textAlign: 'left', transition: 'background 0.2s' }}
                  onMouseOver={e => e.currentTarget.style.background = 'var(--background)'}
                  onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                >
                  <User size={16} /> {copy.profile}
                </button>
                <button 
                  onClick={() => { setActiveDrawer('settings'); setShowUserMenu(false); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', width: '100%', background: 'transparent', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', textAlign: 'left', transition: 'background 0.2s' }}
                  onMouseOver={e => e.currentTarget.style.background = 'var(--background)'}
                  onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                >
                  <Settings size={16} /> {copy.settings}
                </button>
              </div>
              
              <div style={{ padding: '8px', borderTop: '1px solid var(--border)' }}>
                <button 
                  onClick={handleLogout}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', width: '100%', background: 'transparent', color: '#ef4444', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', textAlign: 'left', transition: 'background 0.2s' }}
                  onMouseOver={e => e.currentTarget.style.background = '#fee2e2'}
                  onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                >
                  <LogOut size={16} /> {copy.logout}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: isProMember ? 'var(--primary)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  <Crown size={12} />
                  <span>{isProMember ? '专业版' : '免费版'}</span>
                  {!isProMember && <span style={{ color: 'var(--primary)', fontWeight: 700 }}>· 升级</span>}
                </div>
              </div>
            </div>
            <ChevronUp size={16} color="var(--text-muted)" style={{ transform: showUserMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
          </button>
        </div>
        </>}
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
        
        {/* Chat UI */}
        {activeTab === 'workspace' && (
          <div ref={splitRowRef} style={{ flex: 1, display: 'flex', flexDirection: 'row', height: '100%', overflow: 'hidden', userSelect: resizingSplit ? 'none' : undefined, cursor: resizingSplit ? 'col-resize' : undefined }}>

            {/* Left Column (Chat Area + Input) */}
            <div
              onDragEnter={handleFileDragEnter}
              onDragOver={handleFileDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleFileDrop}
              style={{ flex: showRightPanel ? `0 0 ${chatWidth}%` : 1, width: showRightPanel ? `${chatWidth}%` : 'auto', minWidth: showRightPanel ? '360px' : 0, maxWidth: showRightPanel ? `${chatWidth}%` : '100%', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', transition: resizingSplit ? 'none' : 'flex-basis 0.25s ease', position: 'relative' }}
            >
            {isDraggingFiles && (
              <div aria-hidden="true" style={{ position: 'absolute', inset: '10px', zIndex: 20, display: 'grid', placeItems: 'center', pointerEvents: 'none', border: '2px dashed var(--primary)', borderRadius: '18px', background: 'rgba(236, 253, 245, .9)', boxShadow: '0 16px 50px rgba(16, 185, 129, .16)', backdropFilter: 'blur(4px)' }}>
                <div style={{ display: 'grid', justifyItems: 'center', gap: '10px', color: 'var(--primary)', textAlign: 'center' }}>
                  <span style={{ width: '54px', height: '54px', display: 'grid', placeItems: 'center', borderRadius: '16px', background: 'white', boxShadow: '0 8px 24px rgba(16, 185, 129, .16)' }}><UploadCloud size={28} /></span>
                  <strong style={{ fontSize: '1rem' }}>松开即可添加文件</strong>
                  <span style={{ color: 'var(--text-muted)', fontSize: '.8rem' }}>支持 PDF、Office 文件和常见图片，最多 10 个</span>
                </div>
              </div>
            )}
            
            {/* 聊天区与预览区之间的拖拽分隔条。绝对定位贴在聊天列右缘，
                不占布局位置，往左拖让预览更宽，往右最多拖到一半。 */}
            {showRightPanel && !previewFullscreen && (
              <div
                role="separator"
                aria-orientation="vertical"
                aria-label="调整聊天区与预览区宽度"
                onPointerDown={beginSplitDrag}
                onDoubleClick={() => setChatWidth(DEFAULT_CHAT_WIDTH)}
                title="拖动调整宽度，双击复位"
                style={{ position: 'absolute', zIndex: 6, top: 0, right: 0, bottom: 0, width: '7px', cursor: 'col-resize', touchAction: 'none', background: resizingSplit ? 'var(--primary)' : 'transparent', opacity: resizingSplit ? 0.55 : 1, transition: 'background .15s' }}
                onPointerEnter={(event) => { if (!resizingSplit) event.currentTarget.style.background = 'var(--border)'; }}
                onPointerLeave={(event) => { if (!resizingSplit) event.currentTarget.style.background = 'transparent'; }}
              />
            )}

            {/* Chat Area */}
            {/* minHeight:0 不能少—— flex 列容器的子项默认 min-height:auto，
                会阻止它收缩到内容高度以下，overflowY:auto 因此形同虚设，
                溢出被推给祖先元素，表现为聊天区外面又套了一层滚动条。 */}
            <div ref={chatScrollRef} onScroll={handleChatScroll} onWheel={(event) => { if (event.deltaY < 0) pauseFollowLatest(); }} style={{ flex: 1, minWidth: 0, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: '24px 0', display: 'flex', flexDirection: 'column', gap: '32px', transition: 'padding .2s ease' }}>
              {renderMessages.length === 0 ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', padding: '0 20px' }}>
                  <Sparkles size={48} color="var(--primary)" style={{ marginBottom: '24px', opacity: 0.8 }} />
                  <h2 style={{ marginBottom: '12px', color: 'var(--text-main)', fontSize: '1.8rem', fontWeight: 700 }}>{copy.emptyTitle}</h2>
                  <p style={{ marginBottom: '40px', fontSize: '1.1rem' }}>{copy.emptyDesc}</p>
                  
                  {/* Suggestion Buttons */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', width: '100%', maxWidth: '800px' }}>
                    <button onClick={() => setPrompt(suggestionCopy[0][1])} style={{ padding: '16px', background: 'white', border: '1px solid var(--border)', borderRadius: '16px', textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s', boxShadow: 'var(--shadow-sm)' }} onMouseOver={e => {e.currentTarget.style.borderColor='var(--primary)'; e.currentTarget.style.transform='translateY(-2px)'}} onMouseOut={e => {e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.transform='none'}}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--text-main)', fontWeight: 600 }}><Presentation size={18} color="#ea580c" /> {copy.ppt}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{suggestionCopy[0][0]}</div>
                    </button>
                    <button onClick={() => setPrompt(suggestionCopy[1][1])} style={{ padding: '16px', background: 'white', border: '1px solid var(--border)', borderRadius: '16px', textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s', boxShadow: 'var(--shadow-sm)' }} onMouseOver={e => {e.currentTarget.style.borderColor='var(--primary)'; e.currentTarget.style.transform='translateY(-2px)'}} onMouseOut={e => {e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.transform='none'}}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--text-main)', fontWeight: 600 }}><FileSpreadsheet size={18} color="#16a34a" /> {copy.analysis}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{suggestionCopy[1][0]}</div>
                    </button>
                    <button onClick={() => setPrompt(suggestionCopy[2][1])} style={{ padding: '16px', background: 'white', border: '1px solid var(--border)', borderRadius: '16px', textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s', boxShadow: 'var(--shadow-sm)' }} onMouseOver={e => {e.currentTarget.style.borderColor='var(--primary)'; e.currentTarget.style.transform='translateY(-2px)'}} onMouseOut={e => {e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.transform='none'}}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--text-main)', fontWeight: 600 }}><Bot size={18} color="#8b5cf6" /> {copy.summary}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{suggestionCopy[2][0]}</div>
                    </button>
                    <button onClick={() => setPrompt(suggestionCopy[3][1])} style={{ padding: '16px', background: 'white', border: '1px solid var(--border)', borderRadius: '16px', textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s', boxShadow: 'var(--shadow-sm)' }} onMouseOver={e => {e.currentTarget.style.borderColor='var(--primary)'; e.currentTarget.style.transform='translateY(-2px)'}} onMouseOut={e => {e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.transform='none'}}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--text-main)', fontWeight: 600 }}><Sparkles size={18} color="#3b82f6" /> {copy.polish}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{suggestionCopy[3][0]}</div>
                    </button>
                    <button onClick={() => setPrompt(suggestionCopy[4][1])} style={{ padding: '16px', background: 'white', border: '1px solid var(--border)', borderRadius: '16px', textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s', boxShadow: 'var(--shadow-sm)' }} onMouseOver={e => {e.currentTarget.style.borderColor='var(--primary)'; e.currentTarget.style.transform='translateY(-2px)'}} onMouseOut={e => {e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.transform='none'}}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--text-main)', fontWeight: 600 }}><MessageSquare size={18} color="#06b6d4" /> {copy.translate}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{suggestionCopy[4][0]}</div>
                    </button>
                    <button onClick={() => setPrompt(suggestionCopy[5][1])} style={{ padding: '16px', background: 'white', border: '1px solid var(--border)', borderRadius: '16px', textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s', boxShadow: 'var(--shadow-sm)' }} onMouseOver={e => {e.currentTarget.style.borderColor='var(--primary)'; e.currentTarget.style.transform='translateY(-2px)'}} onMouseOut={e => {e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.transform='none'}}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--text-main)', fontWeight: 600 }}><FileJson size={18} color="#eab308" /> {copy.extract}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{suggestionCopy[5][0]}</div>
                    </button>
                  </div>
                </div>
              ) : (
                renderMessages.map((msg, i) => (
                  <div
                    key={i}
                    ref={(element) => {
                      if (msg.role !== 'user') return;
                      const turnIndex = conversationTimeline.findIndex((turn) => turn.messageIndex === i);
                      if (element) conversationTurnRefs.current.set(turnIndex, element);
                      else conversationTurnRefs.current.delete(turnIndex);
                    }}
                    // overflow-x 必须用 clip 而不是 hidden：按 CSS 规范，一轴为 hidden
                    // 时另一轴的 visible 会被强制计算成 auto，于是每条消息都变成独立
                    // 滚动容器 —— 聊天区因此多出一个滚动条，且流式输出时内容高度反复
                    // 跨越阈值，滚动条不断出现消失形成闪烁。clip 不会触发这个降级。
                    style={{ flex: '0 0 auto', minWidth: 0, maxWidth: 'min(800px, 100%)', overflowX: 'clip', overflowY: 'visible', position: 'relative', display: 'block', margin: '0 auto', width: '100%', padding: '12px 0', borderRadius: '16px', scrollMarginTop: '20px' }}
                  >
                    {msg.role === 'ai' ? (
                      <div style={{ position: 'absolute', top: '12px', left: 0, width: '36px', height: '36px', borderRadius: '50%', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Sparkles size={20} color="var(--primary)" />
                      </div>
                    ) : (
                      <div style={{ position: 'absolute', top: '12px', left: 0, width: '36px', height: '36px', borderRadius: '50%', background: 'var(--text-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>
                        U
                      </div>
                    )}
                    
                    <div style={{ flex: 1, minWidth: 0, maxWidth: '100%', overflowX: 'clip', overflowY: 'visible', paddingTop: '6px' }}>
                      <div style={{ minHeight: '36px', display: 'flex', alignItems: 'center', fontWeight: 600, margin: '0 0 8px 52px', color: 'var(--text-main)' }}>
                        {msg.role === 'ai' ? 'OfficeGPT' : extra.you}
                      </div>
                      
                      {/* User File Attachment */}
                      {msg.role === 'user' && (msg.filenames?.length || msg.filename) ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px', marginBottom: '12px' }}>
                          {(msg.filenames?.length ? msg.filenames : [msg.filename]).map((filename, index) => (
                            <button type="button" key={`${filename}-${index}`} onClick={() => msg.attachments?.[index] && openArtifact(msg.attachments[index])} disabled={!msg.attachments?.[index]} title={msg.attachments?.[index] ? `预览 ${filename}` : filename} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'white', color: 'var(--text-main)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '0.9rem', cursor: msg.attachments?.[index] ? 'pointer' : 'default', textAlign: 'left' }}>
                              {getFileIcon(filename)}
                              <span style={{ fontWeight: 500 }}>{filename}</span>
                            </button>
                          ))}
                        </div>
                      ) : null}

                      {/* Ordered AionCore timeline: thinking, tools and text keep their original positions. */}
                      {msg.blocks?.length > 0 ? <AionMessageTimeline message={msg} /> : <>
                      {msg.thought && <Thinking thought={msg.thought} />}
                      {msg.progress && <TaskProgress progress={msg.progress} />}
                      {msg.loading && !msg.progress && !msg.thought && !msg.content ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
                          <Loader2 size={16} className="spin-anim" /> {copy.thinking}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                          <ChatMarkdown error={msg.error}>{msg.content}</ChatMarkdown>
                          {msg.loading && !msg.progress && msg.content && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                              <Loader2 size={14} className="spin-anim" /> {extra.continuing}
                            </div>
                          )}
                      </div>
                      )}
                      </>}
                      {msg.role === 'ai' && msg.artifacts?.length > 0 && (
                        <div style={{ display: 'grid', gap: '10px', marginTop: '14px' }}>
                          {msg.artifacts.map((artifact) => (
                            <button
                              key={artifact.id}
                              ref={(element) => { if (element) artifactRefs.current.set(artifact.id, element); else artifactRefs.current.delete(artifact.id); }}
                              onClick={() => openArtifact(artifact)}
                              style={{ width: '100%', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid var(--border)', borderRadius: '12px', background: activeArtifact?.id === artifact.id ? 'var(--primary-light)' : 'white', cursor: 'pointer', textAlign: 'left', transition: 'border-color .2s, background .2s, transform .2s' }}
                            >
                              <span style={{ width: '36px', height: '36px', display: 'grid', placeItems: 'center', borderRadius: '9px', background: artifact.fileType?.startsWith('ppt') ? '#fff1e8' : artifact.fileType?.startsWith('xls') ? '#eaf8ef' : '#edf4ff', flexShrink: 0 }}>
                                {artifact.fileType?.startsWith('ppt') ? <Presentation size={19} color="#ea580c" /> : artifact.fileType?.startsWith('xls') ? <FileSpreadsheet size={19} color="#16a34a" /> : <FileText size={19} color="#2563eb" />}
                              </span>
                              <span style={{ minWidth: 0, flex: 1 }}>
                                <span style={{ display: 'block', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{artifact.filename}</span>
                                <span style={{ display: 'block', marginTop: '3px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>{artifact.status === 'generating' && isGenerating ? extra.generatingArtifact : extra.openPreview}</span>
                              </span>
                              <span style={{ color: 'var(--primary)', fontSize: '0.82rem', fontWeight: 600 }}>{copy.preview}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {msg.role === 'ai' && !msg.loading && msg.content && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                          <button type="button" onClick={() => void copyMessage(msg.content, i)} title="复制回复" style={{ width: '28px', height: '28px', display: 'grid', placeItems: 'center', border: 0, borderRadius: '7px', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}>{copiedMessageIndex === i ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}</button>
                          {msg.createdAt ? <span>{new Date(msg.createdAt).toLocaleString('zh-CN')}</span> : null}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
            {conversationTimeline.length > 0 && (
              <aside aria-label="对话时间轴" style={{ position: 'absolute', zIndex: 5, top: '50%', left: 'max(10px, calc(50% - 446px))', width: '38px', transform: 'translateY(-50%)' }}>
                <div style={{ display: 'grid', justifyItems: 'start', gap: '6px' }}>
                  {conversationTimeline.map((turn, turnIndex) => {
                    const active = turnIndex === activeConversationTurn;
                    const hovered = turnIndex === hoveredConversationTurn;
                    return (
                      <button
                        key={turn.messageIndex}
                        type="button"
                        onMouseEnter={() => setHoveredConversationTurn(turnIndex)}
                        onMouseLeave={() => setHoveredConversationTurn(null)}
                        onFocus={() => setHoveredConversationTurn(turnIndex)}
                        onBlur={() => setHoveredConversationTurn(null)}
                        onClick={() => jumpToConversationTurn(turnIndex)}
                        aria-label={`跳转到对话：${turn.question}`}
                        style={{ position: 'relative', width: '38px', height: '7px', padding: 0, display: 'flex', alignItems: 'center', border: 0, background: 'transparent', cursor: 'pointer' }}
                      >
                        <span style={{ flex: '0 0 auto', width: active || hovered ? '14px' : turnIndex % 3 === 0 ? '9px' : '5px', height: '1px', borderRadius: '2px', background: active ? '#111827' : hovered ? '#475569' : '#a8b3c2', transition: 'width .16s, background .16s' }} />
                        {hovered && (
                          <span role="tooltip" style={{ position: 'absolute', left: '44px', top: '50%', width: '320px', padding: '13px 15px', transform: 'translateY(-50%)', display: 'grid', gap: '6px', border: '1px solid var(--border)', borderRadius: '12px', background: 'rgba(255,255,255,.98)', boxShadow: '0 10px 30px rgba(15,23,42,.14)', color: 'var(--text-main)', textAlign: 'left', pointerEvents: 'none' }}>
                            <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.9rem', fontWeight: 600 }}>{turn.question}</strong>
                            <span style={{ display: '-webkit-box', overflow: 'hidden', WebkitBoxOrient: 'vertical', WebkitLineClamp: 3, color: 'var(--text-muted)', fontSize: '0.82rem', lineHeight: 1.55 }}>{turn.reply}</span>
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </aside>
            )}
            {!followLatest && <button type="button" onClick={jumpToLatest} title="回到最新消息" style={{ position: 'absolute', right: '22px', bottom: '148px', zIndex: 3, width: '38px', height: '38px', display: 'grid', placeItems: 'center', border: '1px solid var(--border)', borderRadius: '50%', background: 'white', boxShadow: 'var(--shadow-md)', cursor: 'pointer', color: 'var(--text-main)' }}><ArrowDown size={18} /></button>}

            {/* Input Area */}
            <div style={{ padding: '24px 0', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
              {creditPrompt && (
                <div role="alert" style={{ marginBottom: '10px', padding: '13px 15px', display: 'flex', alignItems: 'center', gap: '14px', border: '1px solid #fed7aa', borderRadius: '14px', background: 'linear-gradient(135deg, #fff7ed, #fffbeb)', boxShadow: '0 8px 24px rgba(154,52,18,.08)' }}>
                  <span style={{ width: '34px', height: '34px', flex: '0 0 auto', display: 'grid', placeItems: 'center', borderRadius: '10px', color: '#c2410c', background: '#ffedd5' }}><Zap size={17} /></span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <strong style={{ display: 'block', color: '#9a3412', fontSize: '0.88rem' }}>Credits 不足，任务尚未开始</strong>
                    <span style={{ display: 'block', marginTop: '2px', color: '#9a5b34', fontSize: '0.76rem', lineHeight: 1.5 }}>{creditPrompt.message}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '7px', flexShrink: 0 }}>
                    <button type="button" onClick={() => { setWechatPayment(null); setActiveDrawer('membership'); }} style={{ padding: '8px 11px', border: '1px solid #fdba74', borderRadius: '9px', background: 'white', color: '#c2410c', fontSize: '0.78rem', fontWeight: 650, cursor: 'pointer' }}>开通会员</button>
                    <button type="button" onClick={() => { setWechatPayment(null); setActiveDrawer('recharge'); }} className="btn btn-primary" style={{ padding: '8px 11px', borderRadius: '9px', fontSize: '0.78rem' }}>充值积分</button>
                  </div>
                </div>
              )}
              {activeTaskId && !showRightPanel && <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}><button type="button" onClick={() => { setShowRightPanel(true); setSidebarCollapsed(true); setRightPanelMode('workspace'); }} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: '9px', background: 'white', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.8rem' }}><FolderOpen size={15} /> {copy.workspace}</button></div>}
              
              <div
                style={{ display: 'flex', flexDirection: 'column', minHeight: files.length ? '132px' : '84px', background: isDraggingFiles ? 'var(--primary-light)' : 'white', border: `1px solid ${isDraggingFiles ? 'var(--primary)' : 'var(--border)'}`, borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', transition: 'min-height 0.2s, background 0.2s, border-color 0.2s', overflow: 'hidden' }}
              >
                {files.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'nowrap', gap: '8px', padding: '10px 12px 4px', overflowX: 'auto', overflowY: 'hidden' }}>
                    {files.map((file, index) => (
                      <div key={`${file.name}-${file.size}-${file.lastModified}`} title={file.name} style={{ flex: '0 0 auto', maxWidth: '220px', display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '7px 9px', background: 'var(--background)', borderRadius: '9px', fontSize: '0.82rem' }}>
                        {getFileIcon(file.name)}
                        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>{file.name}</span>
                        <button type="button" onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`移除 ${file.name}`} style={{ flex: '0 0 auto', width: '20px', height: '20px', padding: 0, display: 'grid', placeItems: 'center', border: 'none', borderRadius: '50%', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={14} /></button>
                      </div>
                    ))}
                  </div>
                )}
                <textarea 
                  ref={promptInputRef}
                  rows={1}
                  value={prompt}
                  onChange={(e) => { setPrompt(e.target.value); resizePromptInput(e.currentTarget); }}
                  onKeyDown={handleKeyDown}
                  placeholder={activeTaskId ? copy.continuePlaceholder : copy.placeholder}
                  style={{ display: 'block', width: '100%', height: '40px', minHeight: '40px', maxHeight: '200px', padding: files.length ? '4px 16px 2px' : '6px 16px 2px', overflowY: 'hidden', border: 'none', resize: 'none', outline: 'none', fontSize: '1rem', lineHeight: '26px', background: 'transparent' }}
                />

                <div style={{ minHeight: '44px', padding: '4px 12px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  {/* Upload Button */}
                  <input type="file" id="file-upload" multiple accept=".pdf,.xlsx,.xls,.csv,.docx,.pptx,.png,.jpg,.jpeg,.webp" onChange={handleFileChange} style={{ display: 'none' }} />
                  <label htmlFor="file-upload" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '50%', background: 'var(--background)', color: 'var(--text-muted)', transition: 'all 0.2s' }}>
                    <Paperclip size={18} />
                  </label>

                  {/* Send / Stop Button */}
                  <button
                    onClick={isGenerating ? handleCancel : handleProcess}
                    disabled={!isGenerating && !prompt.trim()}
                    title={isGenerating ? copy.stop : copy.send}
                    style={{ minWidth: isGenerating ? '88px' : '32px', height: '32px', padding: isGenerating ? '0 11px' : 0, borderRadius: isGenerating ? '8px' : '50%', background: isGenerating ? '#ef4444' : prompt.trim() ? 'var(--primary)' : 'var(--background)', color: isGenerating || prompt.trim() ? 'white' : 'var(--text-muted)', border: 'none', cursor: isGenerating || prompt.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: isGenerating ? '6px' : 0, transition: 'all 0.2s', fontWeight: 600, fontSize: '0.8rem' }}
                  >
                    {isGenerating ? <><StopCircle size={16} /> {copy.stop}</> : <Send size={16} style={{ marginLeft: '2px' }} />}
                  </button>
                </div>
              </div>
              <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                {copy.support}
              </div>
            </div>
          </div>

        {/* Right Panel: OfficeGPT document preview */}
        {showRightPanel && (
          <div ref={previewPanelRef} style={{ flex: 1, minWidth: 0, pointerEvents: resizingSplit ? 'none' : undefined, width: previewFullscreen ? '100vw' : undefined, height: previewFullscreen ? '100vh' : undefined, background: 'white', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', animation: 'slideInRight 0.3s ease-out' }}>
            <div style={{ minHeight: '58px', padding: '9px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}><button type="button" onClick={() => setRightPanelMode('preview')} style={{ padding: '7px 9px', border: 0, borderRadius: '7px', background: rightPanelMode === 'preview' ? 'var(--primary-light)' : 'transparent', color: rightPanelMode === 'preview' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', fontSize: '0.78rem' }}>预览</button><button type="button" onClick={() => setRightPanelMode('workspace')} style={{ padding: '7px 9px', border: 0, borderRadius: '7px', background: rightPanelMode === 'workspace' ? 'var(--primary-light)' : 'transparent', color: rightPanelMode === 'workspace' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', fontSize: '0.78rem' }}>文件</button></div>
              <div style={{ display: 'flex', gap: '6px', minWidth: 0, overflowX: 'auto', flex: 1, scrollbarWidth: 'none' }}>
                {rightPanelMode === 'preview' && previewTabs.map((artifact) => (
                  <button key={artifact.id} onClick={() => setActiveArtifact(artifact)} title={artifact.filename} style={{ maxWidth: '220px', minWidth: '120px', padding: '8px 8px 8px 11px', display: 'flex', alignItems: 'center', gap: '7px', border: '1px solid', borderColor: activeArtifact?.id === artifact.id ? 'var(--primary)' : 'var(--border)', borderRadius: '9px', background: activeArtifact?.id === artifact.id ? 'var(--primary-light)' : 'var(--background)', cursor: 'pointer', color: 'var(--text-main)' }}>
                    <FileText size={15} style={{ flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, textAlign: 'left', fontSize: '0.82rem' }}>{artifact.filename}</span>
                    <span role="button" aria-label={`关闭 ${artifact.filename}`} onClick={(event) => { event.stopPropagation(); closeArtifact(artifact.id); }} style={{ display: 'grid', placeItems: 'center', borderRadius: '5px', flexShrink: 0 }}><X size={14} /></span>
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => void togglePreviewFullscreen()} style={{ width: '34px', height: '34px', display: 'grid', placeItems: 'center', background: 'transparent', border: 'none', borderRadius: '8px', cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0 }} title={previewFullscreen ? '退出全屏预览' : '全屏预览'} aria-label={previewFullscreen ? '退出全屏预览' : '全屏预览'}>{previewFullscreen ? <Minimize2 size={19} /> : <Maximize2 size={19} />}</button>
              <button type="button" onClick={closePreviewPanel} style={{ width: '34px', height: '34px', display: 'grid', placeItems: 'center', background: 'transparent', border: 'none', borderRadius: '8px', cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0 }} title="关闭预览并展开左侧导航" aria-label="关闭预览"><X size={20} /></button>
            </div>
            <div style={{ padding: rightPanelMode === 'workspace' ? 0 : '20px', overflow: 'hidden', flex: 1 }}>
              {rightPanelMode === 'workspace' ? <WorkspaceBrowser taskId={activeTaskId} onOpen={openWorkspaceFile} /> : activeArtifact && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
                  {activeArtifact.generic ? <GenericFilePreview key={activeArtifact.previewUrl} artifact={activeArtifact} /> : <div style={{ position: 'relative', minHeight: '560px', flex: 1, overflow: 'hidden', border: '1px solid var(--border)', borderRadius: '8px', background: '#f8fafc' }}>
                    {previewLoading && <div style={{ position: 'absolute', inset: 0, zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', background: 'linear-gradient(180deg, rgba(255,255,255,.98), rgba(248,250,252,.98))', color: 'var(--text-muted)' }}>
                      <div style={{ width: '46px', height: '46px', display: 'grid', placeItems: 'center', borderRadius: '14px', background: 'var(--primary-light)', color: 'var(--primary)' }}><Loader2 size={23} className="spin-anim" /></div>
                      <div style={{ textAlign: 'center' }}><div style={{ color: 'var(--text-main)', fontSize: '0.92rem', fontWeight: 650 }}>正在准备文件预览</div><div style={{ maxWidth: '320px', marginTop: '5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.78rem' }}>{activeArtifact.filename}</div></div>
                    </div>}
                    <iframe
                      key={activeArtifact.live ? activeArtifact.previewUrl : `${activeArtifact.previewUrl}:${activeArtifact.previewVersion || 0}`}
                      src={activeArtifact.live ? activeArtifact.previewUrl : `${activeArtifact.previewUrl}?v=${activeArtifact.previewVersion || 0}`}
                      title="Office document preview"
                      sandbox="allow-scripts allow-same-origin"
                      onLoad={() => setPreviewLoading(false)}
                      onError={() => { setPreviewLoading(false); setPreviewError('实时预览加载失败'); }}
                      style={{ width: '100%', height: '100%', minHeight: '560px', border: 0, background: 'white', opacity: previewLoading ? 0 : 1, transition: 'opacity .18s ease' }}
                    />
                  </div>}
                  {previewError && <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', border: '1px solid #fecaca', borderRadius: '9px', background: '#fff7f7', color: '#b91c1c', fontSize: '0.82rem' }}><span>{previewError}</span><button type="button" onClick={() => { setPreviewError(''); setPreviewLoading(true); setActiveArtifact((current) => ({ ...current, previewUrl: `${current.previewUrl.split('?')[0]}?retry=${Date.now()}` })); }} style={{ padding: '6px 10px', border: '1px solid #fecaca', borderRadius: '7px', background: 'white', color: '#b91c1c', cursor: 'pointer' }}>重试</button></div>}
                  {activeArtifact.downloadUrl && !(activeArtifact.status === 'generating' && isGenerating) ? (
                    <a href={activeArtifact.downloadUrl} className="btn btn-primary" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      下载
                    </a>
                  ) : <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>正在生成，预览会随 OfficeGPT 文档引擎实时更新…</div>}
                </div>
              )}
            </div>
          </div>
        )}

        </div>
        )}

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div style={{ height: '100%', minHeight: 0, padding: '20px 24px', overflow: 'hidden', display: 'grid', gridTemplateRows: 'auto auto minmax(220px, 1fr) minmax(180px, .78fr)', gap: '14px' }}>
            <div>
              <h1 style={{ fontSize: '1.55rem', marginBottom: '5px' }}>{t('dashboard.overview')}</h1>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.88rem' }}>{overviewCopy.subtitle}</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '14px' }}>
              <div className="glass-card" style={{ padding: '18px', background: 'white', display: 'flex', alignItems: 'center', gap: '13px' }}>
                <div style={{ width: '42px', height: '42px', display: 'grid', placeItems: 'center', background: 'var(--primary-light)', borderRadius: '12px', color: 'var(--primary)' }}><MessageSquare size={20} /></div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '3px' }}>{overviewCopy.conversations}</div>
                  <div style={{ fontSize: '1.45rem', fontWeight: 800 }}>{Number(stats.totalConversations || 0).toLocaleString(locale)}</div>
                </div>
              </div>
              <div className="glass-card" style={{ padding: '18px', background: 'white', display: 'flex', alignItems: 'center', gap: '13px' }}>
                <div style={{ width: '42px', height: '42px', display: 'grid', placeItems: 'center', background: '#eff6ff', borderRadius: '12px', color: '#2563eb' }}><FileText size={20} /></div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '3px' }}>{overviewCopy.tasks}</div>
                  <div style={{ fontSize: '1.45rem', fontWeight: 800 }}>{Number(stats.totalFiles || 0).toLocaleString(locale)}</div>
                </div>
              </div>
              <div className="glass-card" style={{ padding: '18px', background: 'white', display: 'flex', alignItems: 'center', gap: '13px' }}>
                <div style={{ width: '42px', height: '42px', display: 'grid', placeItems: 'center', background: '#fff7ed', borderRadius: '12px', color: '#ea580c' }}><Activity size={20} /></div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '3px' }}>{overviewCopy.tokens}</div>
                  <div style={{ fontSize: '1.45rem', fontWeight: 800 }}>{Number(stats.totalTokens || 0).toLocaleString(locale)}</div>
                </div>
              </div>
              <div className="glass-card" style={{ padding: '18px', background: 'white', display: 'flex', alignItems: 'center', gap: '13px' }}>
                <div style={{ width: '42px', height: '42px', display: 'grid', placeItems: 'center', background: '#eef2ff', borderRadius: '12px', color: '#4f46e5' }}><Clock size={20} /></div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '3px' }}>{overviewCopy.timeSaved}</div>
                  <div style={{ fontSize: '1.45rem', fontWeight: 800 }}>{stats.savedTimeHours} <span style={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--text-muted)' }}>{overviewCopy.hours}</span></div>
                </div>
              </div>
            </div>

            <div style={{ minHeight: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1.45fr) minmax(280px, .85fr)', gap: '14px' }}>
              <section className="glass-card" style={{ minHeight: 0, padding: '18px 20px', background: 'white', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <h2 style={{ fontSize: '0.98rem', margin: '0 0 20px' }}>{overviewCopy.lastSevenDays}</h2>
                <div style={{ minHeight: '100px', flex: 1, display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, stats.dailyActivity?.length || 7)}, minmax(28px, 1fr))`, alignItems: 'end', gap: '10px' }}>
                  {(stats.dailyActivity?.length ? stats.dailyActivity : Array.from({ length: 7 }, (_, index) => ({ date: String(index), count: 0 }))).map((item) => {
                    const maximum = Math.max(1, ...((stats.dailyActivity || []).map((entry) => entry.count)));
                    const height = item.count ? Math.max(12, Math.round((item.count / maximum) * 90)) : 4;
                    const date = new Date(`${item.date}T00:00:00`);
                    return (
                      <div key={item.date} style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: '7px' }}>
                        <span style={{ color: item.count ? 'var(--text-main)' : 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 700 }}>{item.count}</span>
                        <div title={`${item.date}: ${item.count}`} style={{ width: 'min(32px, 70%)', height: `${height}px`, minHeight: '4px', borderRadius: '7px 7px 3px 3px', background: item.count ? 'linear-gradient(180deg, var(--primary), #34d399)' : '#e8edf2', transition: 'height .25s ease' }} />
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>{Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat(locale, { month: 'numeric', day: 'numeric' }).format(date)}</span>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="glass-card" style={{ minHeight: 0, padding: '18px 20px', background: 'white', overflow: 'hidden' }}>
                <h2 style={{ fontSize: '0.98rem', margin: '0 0 18px' }}>{overviewCopy.taskHealth}</h2>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '7px', marginBottom: '14px' }}>
                  <strong style={{ fontSize: '2rem', letterSpacing: '-0.04em' }}>{stats.completionRate || 0}%</strong>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>{overviewCopy.completionRate}</span>
                </div>
                <div style={{ height: '9px', display: 'flex', overflow: 'hidden', borderRadius: '999px', background: '#eef2f5', marginBottom: '18px' }}>
                  <span style={{ width: `${stats.totalFiles ? ((stats.statusCounts?.completed || 0) / stats.totalFiles) * 100 : 0}%`, background: 'var(--primary)' }} />
                  <span style={{ width: `${stats.totalFiles ? (((stats.statusCounts?.processing || 0) + (stats.statusCounts?.pending || 0)) / stats.totalFiles) * 100 : 0}%`, background: '#f59e0b' }} />
                  <span style={{ width: `${stats.totalFiles ? (((stats.statusCounts?.failed || 0) + (stats.statusCounts?.cancelled || 0)) / stats.totalFiles) * 100 : 0}%`, background: '#ef4444' }} />
                </div>
                {[
                  [overviewCopy.completed, stats.statusCounts?.completed || 0, 'var(--primary)'],
                  [overviewCopy.processing, (stats.statusCounts?.processing || 0) + (stats.statusCounts?.pending || 0), '#f59e0b'],
                  [overviewCopy.failed, (stats.statusCounts?.failed || 0) + (stats.statusCounts?.cancelled || 0), '#ef4444'],
                ].map(([label, value, color]) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', fontSize: '0.82rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}><i style={{ width: '7px', height: '7px', borderRadius: '50%', background: color }} />{label}</span>
                    <b>{Number(value).toLocaleString(locale)}</b>
                  </div>
                ))}
              </section>
            </div>

            <div style={{ minHeight: 0, display: 'grid', gridTemplateColumns: 'minmax(340px, 1.2fr) repeat(2, minmax(220px, .8fr))', gap: '14px' }}>
              <section className="glass-card" style={{ minHeight: 0, padding: '16px 20px', background: 'white', overflow: 'hidden' }}>
                <h2 style={{ fontSize: '0.98rem', margin: '0 0 16px' }}>{overviewCopy.creditOverview}</h2>
                {(() => {
                  const sevenDayCredits = (stats.dailyActivity || []).reduce((sum, item) => sum + Number(item.credits || 0), 0);
                  const dailyAverage = sevenDayCredits / 7;
                  const estimatedDays = dailyAverage > 0 ? Math.floor(Number(data.balance || 0) / dailyAverage) : null;
                  const maximum = Math.max(1, ...((stats.dailyActivity || []).map((item) => Number(item.credits || 0))));
                  return (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '14px', marginBottom: '17px' }}>
                        {[
                          [overviewCopy.currentBalance, Number(data.balance || 0).toLocaleString(locale)],
                          [overviewCopy.monthUsage, Number(stats.currentMonthCredits || 0).toLocaleString(locale)],
                          [overviewCopy.lastSevenUsage, sevenDayCredits.toLocaleString(locale)],
                          [overviewCopy.estimatedDays, estimatedDays === null ? overviewCopy.noEstimate : `${Math.min(9999, estimatedDays).toLocaleString(locale)}${estimatedDays > 9999 ? '+' : ''} ${overviewCopy.days}`],
                        ].map(([label, value]) => (
                          <div key={label} style={{ minWidth: 0 }}>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginBottom: '4px' }}>{label}</div>
                            <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '1.02rem' }}>{value}</strong>
                          </div>
                        ))}
                      </div>
                      <div style={{ height: '52px', display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', alignItems: 'end', gap: '6px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
                        {(stats.dailyActivity || []).map((item) => (
                          <span key={item.date} title={`${item.date}: ${Number(item.credits || 0).toLocaleString(locale)} Credits`} style={{ height: `${Math.max(3, Math.round((Number(item.credits || 0) / maximum) * 40))}px`, borderRadius: '4px 4px 2px 2px', background: item.credits ? '#34d399' : '#e8edf2' }} />
                        ))}
                      </div>
                    </>
                  );
                })()}
              </section>

              <section className="glass-card" style={{ minHeight: 0, padding: '16px 20px', background: 'white', overflow: 'hidden' }}>
                <h2 style={{ fontSize: '0.98rem', margin: '0 0 13px' }}>{overviewCopy.outputs}</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '9px' }}>
                  {[
                    ['Excel', stats.artifactTypes?.excel || 0, <FileSpreadsheet key="excel" size={17} />, '#16a34a', '#f0fdf4'],
                    ['Word', stats.artifactTypes?.word || 0, <FileText key="word" size={17} />, '#2563eb', '#eff6ff'],
                    ['PPT', stats.artifactTypes?.ppt || 0, <Presentation key="ppt" size={17} />, '#ea580c', '#fff7ed'],
                    ['PDF', stats.artifactTypes?.pdf || 0, <FileType2 key="pdf" size={17} />, '#dc2626', '#fef2f2'],
                  ].map(([label, value, icon, color, background]) => (
                    <div key={label} style={{ padding: '10px', borderRadius: '10px', background, color }}>
                      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>{icon}<b style={{ color: 'var(--text-main)' }}>{Number(value).toLocaleString(locale)}</b></span>
                      <span style={{ display: 'block', marginTop: '6px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>{label}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="glass-card" style={{ minHeight: 0, padding: '16px 20px', background: 'white', overflow: 'hidden' }}>
                <h2 style={{ fontSize: '0.98rem', margin: '0 0 13px' }}>{overviewCopy.monthlyEfficiency}</h2>
                {(() => {
                  const current = Number(stats.currentMonthTasks || 0);
                  const previous = Number(stats.previousMonthTasks || 0);
                  const change = previous ? Math.round(((current - previous) / previous) * 100) : current ? 100 : 0;
                  const duration = Number(stats.averageTaskSeconds || 0);
                  return (
                    <div style={{ display: 'grid', gap: '12px' }}>
                      <div style={{ paddingBottom: '11px', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginBottom: '4px' }}>{overviewCopy.thisMonthTasks}</div>
                        <strong style={{ fontSize: '1.35rem' }}>{current.toLocaleString(locale)}</strong>
                        <span style={{ marginLeft: '8px', color: change > 0 ? 'var(--primary)' : change < 0 ? '#ef4444' : 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 700 }}>{change ? `${change > 0 ? '+' : ''}${change}%` : overviewCopy.unchanged}</span>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginBottom: '4px' }}>{overviewCopy.averageDuration}</div>
                        <strong style={{ fontSize: '1.35rem' }}>{duration >= 60 ? `${Math.round(duration / 60)} ${extra.minute}` : `${duration} ${overviewCopy.seconds}`}</strong>
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{overviewCopy.monthComparison}</div>
                    </div>
                  );
                })()}
              </section>
            </div>

          </div>
        )}

        {/* Billing Tab */}
        {activeTab === 'billing' && (
          <div style={{ height: '100%', minHeight: 0, padding: '20px 24px', display: 'flex', flexDirection: 'column', overflowY: 'auto', overflowX: 'clip' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexShrink: 0 }}>
              <h1 style={{ fontSize: '1.45rem' }}>{t('dashboard.billing')}</h1>
            </div>
            <div className="glass-card" style={{ padding: '14px 18px', background: 'white', marginBottom: '14px', minHeight: '70px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                <span style={{ width: '38px', height: '38px', display: 'grid', placeItems: 'center', borderRadius: '11px', background: 'var(--primary-light)', color: 'var(--primary)', flexShrink: 0 }}><CreditCard size={19} /></span>
                <div><div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '2px' }}>{t('dashboard.available')}</div><div style={{ fontSize: '1.55rem', lineHeight: 1.1, fontWeight: 800, color: 'var(--primary)' }}>{data.balance.toLocaleString(locale)}</div></div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
                {subscription ? (
                  <div style={{ textAlign: 'right', paddingRight: '14px', borderRight: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                      <Crown size={15} color="var(--primary)" />
                      <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{subscription.membershipLevel}</span>
                    </div>
                    <div style={{ color: subscription.daysLeft <= 7 ? '#c2410c' : 'var(--text-muted)', fontSize: '0.75rem', marginTop: '2px' }}>
                      {subscription.daysLeft <= 7 ? `${subscription.daysLeft} 天后到期` : `有效期至 ${new Date(subscription.currentPeriodEnd).toLocaleDateString('zh-CN')}`}
                    </div>
                  </div>
                ) : null}
                <button type="button" className="btn btn-primary" style={{ padding: '9px 15px', flexShrink: 0 }} onClick={() => { setWechatPayment(null); setActiveDrawer('recharge'); }}>{t('dashboard.wechatTopup')}</button>
              </div>
            </div>

            <div className="glass-card" style={{ minHeight: '300px', flex: '1 1 auto', background: 'white', padding: '0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '11px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}><h2 style={{ fontSize: '1rem' }}>{t('dashboard.details')}</h2></div>
              <div style={{ minHeight: 0, flex: 1, overflow: 'auto' }}><table style={{ width: '100%', minWidth: '720px', borderCollapse: 'separate', borderSpacing: 0, textAlign: 'left' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                  <tr style={{ background: 'var(--background)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '11px 14px', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>{t('dashboard.time')}</th>
                    <th style={{ padding: '11px 14px', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>{t('dashboard.type')}</th>
                    <th style={{ padding: '11px 14px', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>{t('dashboard.detail')}</th>
                    <th style={{ padding: '11px 14px', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>{t('dashboard.inputTokens')}</th>
                    <th style={{ padding: '11px 14px', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>{t('dashboard.outputTokens')}</th>
                    <th style={{ padding: '11px 14px', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>{t('dashboard.amount')}</th>
                    <th style={{ padding: '11px 14px', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>{t('dashboard.balance')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.records.length === 0 && (
                    <tr><td colSpan="7" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>暂无账单记录</td></tr>
                  )}
                  {data.records.map((r) => {
                    const usage = r.metadata?.usage;
                    const balanceDelta = r.balanceDelta ?? (['charge', 'refund'].includes(r.type) ? r.amount : -r.amount);
                    const billingTime = formatBillingDateTime(r.createdAt, locale);
                    return (
                    <tr key={r._id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', verticalAlign: 'top' }}><div>{billingTime.date}</div><div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '2px' }}>{billingTime.time}</div></td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ padding: '4px 8px', background: ['charge', 'refund'].includes(r.type) ? '#d1fae5' : r.type === 'reserve' ? '#e0e7ff' : '#fee2e2', color: ['charge', 'refund'].includes(r.type) ? '#059669' : r.type === 'reserve' ? '#4f46e5' : '#ef4444', borderRadius: '4px', fontSize: '0.8rem' }}>
                          {{ charge: '充值', reserve: '预授权', consume: '消费', refund: '退回', adjustment: '调整' }[r.type] || r.type}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', maxWidth: '360px' }}>{r.description || t('dashboard.balanceChange')}</td>
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>{usage ? (usage.inputTokens || 0).toLocaleString(locale) : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>{usage ? (usage.outputTokens || 0).toLocaleString(locale) : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', fontWeight: 600 }}>{r.amount.toLocaleString(locale)}</td>
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}><span style={{ fontWeight: 700, color: balanceDelta >= 0 ? '#059669' : '#ef4444' }}>{balanceDelta > 0 ? '+' : ''}{balanceDelta.toLocaleString(locale)}</span>{Number.isFinite(r.balanceAfter) ? <span style={{ color: 'var(--text-muted)', marginLeft: '8px' }}>→ {r.balanceAfter.toLocaleString(locale)}</span> : null}</td>
                    </tr>
                  )})}
                </tbody>
              </table></div>
              <div style={{ padding: '9px 14px', borderTop: '1px solid var(--border)', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)', alignItems: 'center', gap: '16px', flexShrink: 0, background: 'white' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>{t('dashboard.count', { count: billingPagination.total.toLocaleString(locale) })}</span>
                <nav aria-label="账单分页" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <button type="button" className="btn btn-outline" style={{ padding: '7px 10px' }} disabled={billingLoading || billingPagination.page <= 1} onClick={() => void fetchBillingPage(billingPagination.page - 1)}>{t('dashboard.previous')}</button>
                  {paginationItems(billingPagination.page, billingPagination.totalPages).map((item) => typeof item === 'number' ? (
                    <button key={item} type="button" disabled={billingLoading} aria-current={item === billingPagination.page ? 'page' : undefined} onClick={() => void fetchBillingPage(item)} style={{ width: '32px', height: '32px', display: 'grid', placeItems: 'center', border: `1px solid ${item === billingPagination.page ? 'var(--primary)' : 'var(--border)'}`, borderRadius: '8px', background: item === billingPagination.page ? 'var(--primary)' : 'white', color: item === billingPagination.page ? 'white' : 'var(--text-main)', fontWeight: item === billingPagination.page ? 700 : 500, cursor: billingLoading ? 'wait' : 'pointer' }}>{item}</button>
                  ) : <span key={item} style={{ width: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>…</span>)}
                  <button type="button" className="btn btn-outline" style={{ padding: '7px 10px' }} disabled={billingLoading || billingPagination.page >= billingPagination.totalPages} onClick={() => void fetchBillingPage(billingPagination.page + 1)}>{t('dashboard.next')}</button>
                </nav>
                <span aria-hidden="true" />
              </div>
            </div>

          </div>
        )}

        {activeTab === 'referral' && (
          <div style={{ height: '100%', minHeight: 0, padding: '20px 24px', overflowY: 'auto', overflowX: 'clip' }}>
            <div style={{ marginBottom: '12px' }}>
              <h1 style={{ fontSize: '1.45rem' }}>{t('dashboard.referral')}</h1>
            </div>
            <ReferralCard locale={locale} />
          </div>
        )}
      </main>
      
      {/* 删除确认属于整个工作台，不能放在某个页面的条件渲染内部。 */}
      {deleteConfirmDialog.isOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.42)', backdropFilter: 'blur(5px)' }} onClick={() => setDeleteConfirmDialog({ isOpen: false, taskId: null })} />
          <div role="dialog" aria-modal="true" aria-labelledby="delete-task-title" style={{ background: 'white', padding: '28px', borderRadius: '16px', width: '100%', maxWidth: '400px', position: 'relative', zIndex: 1, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <h3 id="delete-task-title" style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '9px' }}>
              <span style={{ width: '38px', height: '38px', borderRadius: '10px', display: 'grid', placeItems: 'center', background: '#fef2f2' }}><Trash2 size={19} color="#dc2626" /></span>
              {copy.deleteTitle}
            </h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px', lineHeight: 1.65 }}>{copy.deleteText}</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" onClick={() => setDeleteConfirmDialog({ isOpen: false, taskId: null })} style={{ padding: '10px 18px', borderRadius: '9px', border: '1px solid var(--border)', background: 'white', color: 'var(--text-main)', cursor: 'pointer', fontWeight: 600 }}>{copy.cancel}</button>
              <button type="button" onClick={executeDeleteTask} style={{ padding: '10px 18px', borderRadius: '9px', border: 'none', background: '#dc2626', color: 'white', cursor: 'pointer', fontWeight: 600 }}>{copy.confirmDelete}</button>
            </div>
          </div>
        </div>
      )}

      {wechatPayment?.purpose === 'subscription' && wechatPayment.status === 'paying' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 11000, display: 'grid', placeItems: 'center', padding: '20px' }}>
          <button type="button" aria-label="关闭会员支付" onClick={() => setWechatPayment(null)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, background: 'rgba(2,8,23,.62)', backdropFilter: 'blur(7px)' }} />
          <div role="dialog" aria-modal="true" aria-label="会员订阅微信支付" style={{ position: 'relative', zIndex: 1, width: '390px', maxWidth: '100%', padding: '28px', borderRadius: '22px', background: 'white', boxShadow: '0 30px 90px rgba(0,0,0,.34)', textAlign: 'center' }}>
            <button type="button" onClick={() => setWechatPayment(null)} aria-label="关闭" style={{ position: 'absolute', top: '13px', right: '13px', width: '32px', height: '32px', display: 'grid', placeItems: 'center', border: 0, borderRadius: '9px', background: '#f8fafc', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={17} /></button>
            <span style={{ width: '44px', height: '44px', margin: '0 auto 12px', display: 'grid', placeItems: 'center', borderRadius: '13px', color: '#047857', background: '#d1fae5' }}><Crown size={22} /></span>
            <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.18rem' }}>微信扫码开通专业版</h3>
            <p style={{ margin: '7px 0 17px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>请使用微信扫描二维码完成支付</p>
            <div style={{ width: '252px', height: '252px', margin: '0 auto', padding: '6px', border: '1px solid var(--border)', borderRadius: '16px', background: 'white', boxShadow: '0 10px 28px rgba(15,23,42,.08)' }}>
              <Image src={wechatPayment.qrCodeDataUrl} alt="会员订阅微信支付二维码" width={240} height={240} unoptimized style={{ display: 'block', width: '240px', height: '240px', borderRadius: '10px' }} />
            </div>
            <div style={{ marginTop: '17px', color: 'var(--text-main)' }}>支付金额 <strong style={{ color: 'var(--primary)', fontSize: '1.3rem' }}>¥{wechatPayment.amountYuan}</strong></div>
            <p style={{ margin: '7px 0 0', color: 'var(--text-muted)', fontSize: '0.76rem', lineHeight: 1.6 }}>支付成功后将自动关闭窗口、刷新会员状态并发放赠送 Credits</p>
            <button type="button" className="btn btn-outline" onClick={() => setWechatPayment(null)} style={{ width: '100%', marginTop: '18px', justifyContent: 'center' }}>取消支付</button>
          </div>
        </div>
      )}

      {/* Global Centered Modal */}
      {activeDrawer && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          
          {/* Backdrop */}
          <div 
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)', animation: 'fadeIn 0.2s ease-out' }} 
            onClick={() => setActiveDrawer(null)}
          />
          
          {/* Modal Panel */}
          <div style={{ width: activeDrawer === 'membership' ? '820px' : activeDrawer === 'recharge' ? '680px' : '480px', maxWidth: '100%', maxHeight: '90vh', background: '#fefefe', borderRadius: '18px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', position: 'relative', zIndex: 1, animation: 'scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            
            {/* Modal Header */}
            <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'white' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px' }}>
                {activeDrawer === 'membership' && <><Crown color="var(--primary)" /> 会员订阅</>}
                {activeDrawer === 'recharge' && <><CreditCard color="var(--primary)" /> Credits 充值</>}
                {activeDrawer === 'profile' && <><User color="var(--text-main)" /> {copy.profile}</>}
                {activeDrawer === 'settings' && <><Settings color="var(--text-main)" /> {copy.settings}</>}
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
              
              {/* MEMBERSHIP / RECHARGE CONTENT */}
              {['membership', 'recharge'].includes(activeDrawer) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {activeDrawer === 'membership' && <>
                  {/* 余额与当前订阅并排，把宽度用起来 */}
                  <div style={{ padding: '24px 26px', borderRadius: '16px', color: 'white', background: 'linear-gradient(135deg, #064e3b 0%, #047857 58%, #10b981 120%)', boxShadow: '0 16px 36px -20px rgba(4,120,87,.75)' }}>
                    {isProMember ? (
                      <div style={{ padding: '20px 24px', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(255,255,255,.2)', background: 'rgba(255,255,255,.08)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ color: 'rgba(255,255,255,.68)', marginBottom: '6px', fontSize: '0.82rem' }}>当前会员</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                            <Crown size={21} color="#fbbf24" />
                            <span style={{ fontSize: '1.55rem', fontWeight: 800, lineHeight: 1.1 }}>专业版</span>
                          </div>
                          {subscription ? <div style={{ color: subscription.daysLeft <= 7 ? '#fbbf24' : 'rgba(255,255,255,.72)', fontSize: '0.8rem', marginTop: '8px' }}>
                            有效期至 {new Date(subscription.currentPeriodEnd).toLocaleDateString('zh-CN')}（剩余 {subscription.daysLeft} 天）
                          </div> : <div style={{ color: 'rgba(255,255,255,.72)', fontSize: '0.8rem', marginTop: '8px' }}>专业版权益已生效</div>}
                        </div>
                        {subscription && <div style={{ marginTop: '10px' }}>
                          <button type="button" style={{ padding: '7px 12px', fontSize: '0.78rem', whiteSpace: 'nowrap', border: '1px solid rgba(255,255,255,.3)', borderRadius: '8px', color: 'white', background: 'rgba(255,255,255,.1)', cursor: 'pointer' }} onClick={() => void handleToggleAutoRenew(!subscription.autoRenew)}>
                            {subscription.autoRenew ? '关闭续订提醒' : '恢复续订提醒'}
                          </button>
                        </div>}
                      </div>
                    ) : <div>
                      <div style={{ color: 'rgba(255,255,255,.66)', fontSize: '0.82rem' }}>当前会员</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginTop: '8px' }}><Crown size={22} color="#fbbf24" /><strong style={{ fontSize: '1.55rem' }}>免费版</strong></div>
                      <p style={{ marginTop: '10px', color: 'rgba(255,255,255,.72)', fontSize: '0.86rem' }}>升级专业版，获得更多 Credits、更高并发与完整办公能力。</p>
                    </div>}
                  </div>

                  <div>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '14px', color: 'var(--text-main)' }}>会员订阅</h3>

                    {plans.length === 0 ? (
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '10px 0' }}>正在加载套餐…</div>
                    ) : (() => {
                      const plan = plans.find((item) => item.id === selectedPlanId) || plans[0];
                      const quote = plan?.quotes.find((item) => item.periodMonths === selectedPeriodMonths) || plan?.quotes[0];
                      if (!plan || !quote) return null;
                      return (
                        <div style={{ display: 'grid', gap: '16px' }}>
                          <div style={{ display: 'grid', gap: '11px' }}>
                            {plan.quotes.map((item, index) => {
                              const picked = item.periodMonths === quote.periodMonths;
                              const monthlyEquivalent = item.amountFen / item.periodMonths / 100;
                              const recommended = item.periodMonths === 12;
                              return (
                                <button
                                  key={item.periodMonths}
                                  type="button"
                                  onClick={() => { setSelectedPlanId(plan.id); setSelectedPeriodMonths(item.periodMonths); }}
                                  style={{ position: 'relative', width: '100%', display: 'grid', gridTemplateColumns: '54px minmax(0, 1fr) auto', alignItems: 'center', gap: '16px', padding: '18px 20px', textAlign: 'left', border: `2px solid ${picked ? 'var(--primary)' : 'var(--border)'}`, borderRadius: '14px', background: picked ? 'linear-gradient(135deg, rgba(16,185,129,.09), rgba(99,102,241,.07))' : 'white', boxShadow: picked ? '0 10px 28px -18px rgba(5,150,105,.8)' : 'none', cursor: 'pointer', transition: 'border-color .18s ease, background .18s ease, transform .18s ease' }}
                                >
                                  <span style={{ width: '26px', height: '26px', borderRadius: '50%', border: `2px solid ${picked ? 'var(--primary)' : '#cbd5e1'}`, background: picked ? 'var(--primary)' : 'white', display: 'grid', placeItems: 'center', color: 'white' }}>{picked && <Check size={15} strokeWidth={3} />}</span>
                                  <span style={{ minWidth: 0 }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <strong style={{ fontSize: '1.05rem', color: picked ? 'var(--primary)' : 'var(--text-main)' }}>{item.periodLabel}专业版</strong>
                                      {recommended && <span style={{ padding: '3px 8px', borderRadius: '999px', background: '#111827', color: 'white', fontSize: '0.68rem', fontWeight: 700 }}>最划算</span>}
                                      {index === 1 && <span style={{ padding: '3px 8px', borderRadius: '999px', background: '#ecfdf5', color: '#047857', fontSize: '0.68rem', fontWeight: 700 }}>热门</span>}
                                    </span>
                                    <span style={{ display: 'block', marginTop: '7px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{item.grantCredits.toLocaleString('zh-CN')} Credits · 并发上限 5 · 优先任务队列</span>
                                  </span>
                                  <span style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                    <span style={{ display: 'block', color: 'var(--text-main)', fontSize: '1.4rem', fontWeight: 800 }}>¥{(item.amountFen / 100).toFixed(2)}</span>
                                    <span style={{ display: 'block', marginTop: '3px', color: 'var(--text-muted)', fontSize: '0.72rem' }}>约 ¥{monthlyEquivalent.toFixed(2)}/月</span>
                                    {item.savedFen > 0 && <span style={{ display: 'block', marginTop: '5px', color: '#059669', fontSize: '0.72rem', fontWeight: 700 }}>立省 ¥{(item.savedFen / 100).toFixed(2)}</span>}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '15px 18px', borderRadius: '12px', background: '#f8fafc', border: '1px solid var(--border)' }}>
                            <div>
                              <div style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>已选择 {quote.periodLabel}专业版</div>
                              <div style={{ marginTop: '3px', color: 'var(--text-main)', fontSize: '0.84rem' }}>到账 {quote.grantCredits.toLocaleString('zh-CN')} Credits，有效期 {quote.periodMonths} 个月</div>
                            </div>
                            <div style={{ textAlign: 'right' }}><span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>应付 </span><strong style={{ color: 'var(--primary)', fontSize: '1.45rem' }}>¥{(quote.amountFen / 100).toFixed(2)}</strong></div>
                          </div>
                          <button type="button" onClick={handleSubscribe} disabled={subscribeLoading || (wechatPayment && wechatPayment.status === 'paying')} className="btn btn-primary" style={{ justifyContent: 'center', padding: '14px', borderRadius: '11px', fontSize: '0.95rem' }}>
                            {subscribeLoading ? <><Loader2 size={16} className="spin-anim" /> 正在创建订单…</> : subscription ? `立即续费 · ¥${(quote.amountFen / 100).toFixed(2)}` : `立即订阅 · ¥${(quote.amountFen / 100).toFixed(2)}`}
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                  </>}

                  {activeDrawer === 'recharge' && <>
                  <div style={{ padding: '18px 20px', borderRadius: '14px', background: 'linear-gradient(135deg, #ecfdf5, #eef2ff)', border: '1px solid #d1fae5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>本次充值预计到账</div>
                      <strong style={{ display: 'block', marginTop: '4px', color: 'var(--primary)', fontSize: '1.8rem' }}>{(wechatPayment?.credits || Math.max(0, rechargeAmountYuan || 0) * 1000).toLocaleString()} Credits</strong>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>¥1 = 1,000 Credits</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: '4px' }}>当前余额 {data.balance.toLocaleString()}</div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: wechatPayment && ['paying', 'paid'].includes(wechatPayment.status) ? '1fr' : '1fr 1fr', gap: '24px', alignItems: 'start' }}>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', color: 'var(--text-main)' }}>微信支付充值</h3>
                    {!wechatPayment || !['paying', 'paid'].includes(wechatPayment.status) ? <div style={{ display: 'grid', gap: '14px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>{[10, 50, 100, 500].map((amount) => <button key={amount} type="button" onClick={() => setRechargeAmountYuan(amount)} style={{ padding: '10px', border: `1px solid ${rechargeAmountYuan === amount ? 'var(--primary)' : 'var(--border)'}`, borderRadius: '9px', background: rechargeAmountYuan === amount ? 'var(--primary-light)' : 'white', color: rechargeAmountYuan === amount ? 'var(--primary)' : 'var(--text-main)', cursor: 'pointer', fontWeight: 600 }}>¥{amount}</button>)}</div>
                      <label style={{ display: 'grid', gap: '7px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>自定义金额（人民币）<input type="number" min="1" max="10000" step="1" value={rechargeAmountYuan} onChange={(event) => setRechargeAmountYuan(Number(event.target.value))} style={{ padding: '13px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', fontSize: '1rem' }} /></label>
                      <button type="button" onClick={handleWechatRecharge} disabled={wechatPaymentLoading} className="btn btn-primary" style={{ justifyContent: 'center', padding: '13px' }}>{wechatPaymentLoading ? <><Loader2 size={16} className="spin-anim" /> 正在创建订单…</> : '微信扫码支付'}</button>
                    </div> : <div style={{ textAlign: 'center', padding: '18px', border: '1px solid var(--border)', borderRadius: '14px', background: '#f8fafc' }}>
                      {wechatPayment.status === 'paid' ? <><Check size={42} color="#059669" /><h4 style={{ marginTop: '8px', color: '#059669' }}>{wechatPayment.purpose === 'subscription' ? '会员已开通' : '充值成功'}</h4><p style={{ marginTop: '6px', color: 'var(--text-muted)' }}>{wechatPayment.credits?.toLocaleString()} Credits 已到账</p><button type="button" className="btn btn-outline" style={{ marginTop: '14px' }} onClick={() => void handlePaymentComplete()}>完成</button></> : <><Image src={wechatPayment.qrCodeDataUrl} alt="微信支付二维码" width={240} height={240} unoptimized style={{ width: '240px', height: '240px', borderRadius: '10px' }} /><h4 style={{ marginTop: '10px' }}>微信扫码支付 ¥{wechatPayment.amountYuan}</h4><p style={{ marginTop: '6px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>{wechatPayment.purpose === 'subscription' ? '支付完成后会员立即生效，无需手动刷新' : '支付完成后将自动到账，无需手动刷新'}</p><button type="button" className="btn btn-outline" style={{ marginTop: '12px' }} onClick={() => setWechatPayment(null)}>取消本次支付</button></>}
                    </div>}
                  </div>

                  <div style={{ display: wechatPayment && ['paying', 'paid'].includes(wechatPayment.status) ? 'none' : 'block' }}>
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
                  </div>

                  <div style={{ padding: '16px', background: '#f8fafc', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                    <p style={{ marginBottom: '8px', fontWeight: 600, color: 'var(--text-main)' }}>充值说明：</p>
                    <p>1. Credits 根据模型实际返回的输入、输出和缓存 Token 用量结算。</p>
                    <p>2. 卡密一经兑换即刻生效，不设有效期。</p>
                    <p>3. 如需大客户专属私有化模型接入方案，请联系官方支持团队。</p>
                  </div>
                  </>}
                </div>
              )}

              {/* PROFILE CONTENT */}
              {activeDrawer === 'profile' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary) 0%, #6366f1 100%)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '2.5rem', marginBottom: '16px', boxShadow: 'var(--shadow-md)' }}>
                      {user?.username?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <h3 style={{ fontSize: '1.4rem', fontWeight: 600, marginBottom: '4px' }}>{user?.username || copy.user}</h3>
                    <p style={{ color: 'var(--text-muted)' }}>{user?.phone || '手机号用户'}</p>
                  </div>

                  <PhonePasswordForm />

                </div>
              )}

              {/* SETTINGS CONTENT */}
              {activeDrawer === 'settings' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                  
                  {/* Theme Section */}
                  <section>
                    <h4 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '16px', textTransform: 'uppercase' }}>{copy.appearance}</h4>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ padding: '8px', background: 'var(--background)', borderRadius: '8px' }}><Moon size={18} color="var(--text-main)" /></div>
                        <div>
                          <div style={{ fontWeight: 500 }}>{copy.darkMode}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{copy.darkDesc}</div>
                        </div>
                      </div>
                      <div style={{ width: '44px', height: '24px', background: 'var(--border)', borderRadius: '12px', position: 'relative', cursor: 'not-allowed', opacity: 0.5 }}>
                        <div style={{ width: '20px', height: '20px', background: 'white', borderRadius: '50%', position: 'absolute', top: '2px', left: '2px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} />
                      </div>
                    </div>
                  </section>

                  {/* Notification Section */}
                  <section>
                    <h4 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '16px', textTransform: 'uppercase' }}>{copy.notifications}</h4>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ padding: '8px', background: 'var(--primary-light)', borderRadius: '8px' }}><Bell size={18} color="var(--primary)" /></div>
                        <div>
                          <div style={{ fontWeight: 500 }}>{copy.sound}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{copy.soundDesc}</div>
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
