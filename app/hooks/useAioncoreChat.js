'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createAioncoreRealtimeClient } from '@/lib/api/aioncore-ws';
import {
  createRuntimeState,
  mapMessagesToUi,
  mergeHistoryMessages,
  mergeStreamMessages,
  reduceRuntime,
} from '@/lib/aioncore/chat-reducer';
import { chatLog, chatWarn } from '@/lib/aioncore/logger';
import { autoConfirmPermission, buildAutoConfirmation, listPendingPermissions } from '@/lib/aioncore/auto-confirm';
import { isTransientWorkspaceArtifact } from '@/lib/workspace/artifact-names';

export function useAioncoreChat() {
  const [messages, setMessages] = useState([]);
  const messagesRef = useRef([]);
  const [runtime, setRuntime] = useState(createRuntimeState);
  const runtimeRef = useRef(createRuntimeState());
  const [officeArtifact, setOfficeArtifact] = useState(null);
  const clientRef = useRef(null);
  const conversationIdRef = useRef(null);
  const frameRef = useRef(null);
  const queueRef = useRef([]);
  const queuedSignaturesRef = useRef(new Map());
  const flushingRef = useRef(false);
  const taskIdRef = useRef(null);
  const workspaceRef = useRef('');
  const pendingOfficeFilesRef = useRef([]);
  const officeOpenTimersRef = useRef(new Map());
  const confirmationsInFlightRef = useRef(new Set());
  const generationTraceRef = useRef({ conversationId: null, startedAt: 0, firstEventSeen: false });

  const approvePermission = useCallback((payload) => {
    if (process.env.NEXT_PUBLIC_AIONCORE_AUTO_APPROVE === 'false') return;
    const confirmation = buildAutoConfirmation(payload);
    const confirmationKey = confirmation
      ? `${confirmation.conversationId}:${confirmation.callId}`
      : `${payload.conversation_id || 'unknown'}:${payload.msg_id || 'unknown'}`;
    if (confirmationsInFlightRef.current.has(confirmationKey)) return;
    confirmationsInFlightRef.current.add(confirmationKey);
    chatWarn('permission', `automatically approving ${confirmationKey}`, payload);
    void autoConfirmPermission(payload)
      .then((approved) => chatLog('permission', `approved ${approved.callId} with ${approved.selected}`, payload))
      .catch((error) => {
        confirmationsInFlightRef.current.delete(confirmationKey);
        chatWarn('permission', error.message, payload);
      });
  }, []);

  const recoverPendingPermissions = useCallback(async (conversationId) => {
    if (process.env.NEXT_PUBLIC_AIONCORE_AUTO_APPROVE === 'false') return;
    try {
      const pending = await listPendingPermissions(conversationId);
      chatLog('permission', `recovered ${pending.length} pending confirmation(s)`, { conversation_id: conversationId });
      for (const permission of pending) approvePermission(permission);
    } catch (error) {
      chatWarn('permission', error.message, { conversation_id: conversationId });
    }
  }, [approvePermission]);

  const startOfficePreview = useCallback(async (event) => {
    const taskId = taskIdRef.current;
    const workspace = workspaceRef.current || event.workspace;
    if (!taskId || !workspace) {
      pendingOfficeFilesRef.current.push(event);
      chatLog('preview', 'queued Office file until task binding is ready', event);
      return;
    }
    try {
      chatLog('preview', `starting live preview for ${event.file_path}`, event);
      const response = await fetch(`/api/tasks/${taskId}/office-preview/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: event.file_path, workspace }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || '启动 Office 实时预览失败');
      setOfficeArtifact({ ...payload, id: `${payload.taskId}:${payload.artifactId}`, live: true, previewVersion: Date.now() });
      chatLog('preview', `live preview ready for ${payload.filename}`, event);
    } catch (error) {
      chatWarn('preview', error.message, event);
    }
  }, []);

  const openOfficePreview = useCallback((event) => {
    const normalizedPath = String(event.file_path || '').replaceAll('\\', '/').replace(/^\/private\/(tmp|var)(?=\/)/, '/$1');
    if (!normalizedPath || isTransientWorkspaceArtifact(normalizedPath) || officeOpenTimersRef.current.has(normalizedPath)) return;
    const timer = window.setTimeout(() => {
      officeOpenTimersRef.current.delete(normalizedPath);
      void startOfficePreview({ ...event, file_path: normalizedPath });
    }, 900);
    officeOpenTimersRef.current.set(normalizedPath, timer);
  }, [startOfficePreview]);

  const applyRuntimeEvent = useCallback((name, payload) => {
    const previous = runtimeRef.current;
    const next = reduceRuntime(previous, name, payload);
    if (next === previous) return;
    runtimeRef.current = next;
    if (previous.isProcessing !== next.isProcessing) {
      chatLog('generation', `runtime ${previous.state}/${previous.isProcessing} -> ${next.state}/${next.isProcessing}`, payload);
    }
    setRuntime(next);
  }, []);

  // 具名函数表达式，便于重入时把自己重新排进下一帧。
  const flushMessageQueue = useCallback(function flush() {
    // 这一帧已经消费掉了：无论走哪条分支，都必须先把 frameRef 清空，
    // 否则「已触发但未清空」的 id 会让下方 `if (!frameRef.current)` 永远为假，
    // 后续帧再也调度不出新的 rAF，界面就此停止更新。
    frameRef.current = null;
    if (flushingRef.current) {
      // 重入时不丢数据：留到下一帧再处理。
      if (queueRef.current.length) frameRef.current = requestAnimationFrame(flush);
      return;
    }
    flushingRef.current = true;
    const queued = queueRef.current.splice(0);
    try {
      if (!queued.length) return;
      const previous = messagesRef.current;
      const next = queued.reduce(mergeStreamMessages, previous);
      if (next !== previous) {
        messagesRef.current = next;
        setMessages(next);
      }
    } finally {
      flushingRef.current = false;
    }
  }, []);

  useEffect(() => {
    const client = createAioncoreRealtimeClient();
    const officeOpenTimers = officeOpenTimersRef.current;
    const messageQueue = queueRef.current;
    const queuedSignatures = queuedSignaturesRef.current;
    const belongsToActiveConversation = (payload) => !conversationIdRef.current
      || !payload?.conversation_id
      || payload.conversation_id === conversationIdRef.current;
    clientRef.current = client;
    const subscriptions = [
      client.on('realtime.connected', () => applyRuntimeEvent('realtime.connected', {})),
      client.on('realtime.error', (payload) => {
        chatWarn('generation', 'realtime generation failed', payload);
        applyRuntimeEvent('realtime.error', payload);
      }),
      client.on('realtime.disconnected', (payload) => {
        applyRuntimeEvent('realtime.disconnected', payload);
      }),
      client.on('realtime.reconnected', (payload) => {
        applyRuntimeEvent('realtime.reconnected', payload);
        if (conversationIdRef.current) {
          client.send('chat:history:load', { conversation_id: conversationIdRef.current });
          void recoverPendingPermissions(conversationIdRef.current);
        }
      }),
      client.on('session:state', (payload) => {
        if (payload?.conversation_id && !conversationIdRef.current) {
          conversationIdRef.current = payload.conversation_id;
        }
      }),
      client.on('chat:history:page', (payload) => {
        if (Array.isArray(payload?.items)) {
          if (payload.conversation_id && payload.conversation_id !== conversationIdRef.current) return;
          chatLog('history', `loaded ${payload.items.length} message(s)`, payload);
          const next = mergeHistoryMessages(messagesRef.current, payload.items, conversationIdRef.current);
          messagesRef.current = next;
          setMessages(next);
        }
      }),
      client.on('chat:turn:state', (payload) => {
        if (belongsToActiveConversation(payload)) applyRuntimeEvent('chat:turn:state', payload);
      }),
      client.on('turn.completed', (payload) => {
        if (belongsToActiveConversation(payload)) applyRuntimeEvent('turn.completed', payload);
      }),
      client.on('workspaceOfficeWatch.fileAdded', (event) => {
        if (workspaceRef.current && event.workspace !== workspaceRef.current) return;
        void openOfficePreview(event);
      }),
      client.on('message.stream', (payload) => {
        if (!belongsToActiveConversation(payload)) return;
        const trace = generationTraceRef.current;
        if (!trace.firstEventSeen && payload?.conversation_id === trace.conversationId) {
          trace.firstEventSeen = true;
          chatLog('generation', `first stream event after ${Date.now() - trace.startedAt}ms`, payload);
        }
        if (['finish', 'error', 'cancelled'].includes(payload?.type)) {
          chatLog('generation', `terminal stream event after ${trace.startedAt ? Date.now() - trace.startedAt : 0}ms`, payload);
        }
        applyRuntimeEvent('message.stream', payload);
        if (payload?.type === 'permission' || payload?.type === 'acp_permission') {
          approvePermission(payload);
        }
        if (!payload?.msg_id) {
          chatLog('messages', `runtime-only stream event ${payload?.type || '(unknown type)'}`, payload);
          return;
        }
        const signatureKey = `${payload.conversation_id || ''}:${payload.msg_id}:${payload.type || ''}`;
        let signature;
        try { signature = JSON.stringify(payload); } catch { signature = String(payload); }
        if (queuedSignaturesRef.current.get(signatureKey) === signature) {
          chatLog('messages', `ignored duplicate stream event ${signatureKey}`);
          return;
        }
        queuedSignaturesRef.current.set(signatureKey, signature);
        if (queuedSignaturesRef.current.size > 1000) {
          const oldest = queuedSignaturesRef.current.keys().next().value;
          queuedSignaturesRef.current.delete(oldest);
        }
        queueRef.current.push(payload);
        if (!frameRef.current) frameRef.current = requestAnimationFrame(flushMessageQueue);
      }),
    ];
    return () => {
      for (const unsubscribe of subscriptions) unsubscribe();
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      messageQueue.length = 0;
      queuedSignatures.clear();
      flushingRef.current = false;
      for (const timer of officeOpenTimers.values()) window.clearTimeout(timer);
      officeOpenTimers.clear();
      client.close();
      clientRef.current = null;
    };
  }, [applyRuntimeEvent, approvePermission, flushMessageQueue, openOfficePreview, recoverPendingPermissions]);

  const loadConversation = useCallback((id, taskId, workspace = '', options = {}) => {
    chatLog('conversation', `load ${id}`);
    conversationIdRef.current = id;
    taskIdRef.current = taskId || taskIdRef.current;
    workspaceRef.current = workspace || workspaceRef.current;
    if (options.loadHistory !== false) {
      clientRef.current?.send('chat:history:load', { conversation_id: id });
    }
    void recoverPendingPermissions(id);
    const pending = pendingOfficeFilesRef.current.splice(0);
    for (const event of pending) void openOfficePreview(event);
  }, [openOfficePreview, recoverPendingPermissions]);

  const waitUntilConnected = useCallback(async () => {
    const client = clientRef.current;
    if (!client) throw new Error('实时连接尚未初始化，请稍后重试');
    await client.ready();
    chatLog('conversation', 'realtime connection confirmed ready');
  }, []);

  const sendMessage = useCallback((text, attachedFiles = [], overrideConversationId = null) => {
    const activeId = overrideConversationId || conversationIdRef.current;
    if (!activeId) {
      chatWarn('conversation', 'send ignored because conversation id is missing');
      return;
    }
    const files = Array.isArray(attachedFiles) ? attachedFiles : attachedFiles ? [attachedFiles] : [];
    generationTraceRef.current = { conversationId: activeId, startedAt: Date.now(), firstEventSeen: false };
    chatLog('generation', `client bound files=${files.length}`, { conversation_id: activeId });
    conversationIdRef.current = activeId;
    applyRuntimeEvent('local.send', {});
    const nextMessages = [
      ...messagesRef.current,
      {
        role: 'user',
        type: 'text',
        content: { content: text, filename: files[0]?.name, filenames: files.map((file) => file.name) },
        msg_id: `local-user-${crypto.randomUUID()}`,
        conversation_id: activeId,
      },
    ];
    messagesRef.current = nextMessages;
    setMessages(nextMessages);
  }, [applyRuntimeEvent]);

  const cancelGeneration = useCallback(async (overrideConversationId = null) => {
    const activeId = overrideConversationId || conversationIdRef.current;
    if (!activeId) throw new Error('当前没有可停止的会话');
    let turnId = runtimeRef.current.activeTurnId;
    if (!turnId) {
      const stateResponse = await fetch(`/api/aioncore/api/conversations/${encodeURIComponent(activeId)}`);
      const statePayload = await stateResponse.json().catch(() => ({}));
      if (!stateResponse.ok) throw new Error(statePayload.error || '读取会话运行状态失败');
      turnId = statePayload.data?.runtime?.turn_id || statePayload.runtime?.turn_id;
    }
    if (!turnId) throw new Error('当前会话已经结束，无需停止');
    chatLog('conversation', `cancel ${activeId} turn ${turnId}`);
    applyRuntimeEvent('local.cancel', { turn_id: turnId });
    try {
      const response = await fetch(`/api/aioncore/api/conversations/${encodeURIComponent(activeId)}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ turn_id: turnId }),
      });
      const payload = await response.json().catch(() => ({}));
      const errorText = typeof payload.error === 'string' ? payload.error : payload.error?.message;
      if (!response.ok) throw new Error(errorText || payload.message || '停止生成失败');
      return payload;
    } catch (error) {
      applyRuntimeEvent('local.cancel.failed', { error: error.message });
      throw error;
    }
  }, [applyRuntimeEvent]);

  const uiMessages = useMemo(() => mapMessagesToUi(messages, runtime), [messages, runtime]);

  return {
    messages: uiMessages,
    officeArtifact,
    isProcessing: runtime.isProcessing,
    sendMessage,
    loadConversation,
    waitUntilConnected,
    cancelGeneration,
  };
}
