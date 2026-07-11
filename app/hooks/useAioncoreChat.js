'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createAioncoreRealtimeClient } from '@/lib/api/aioncore-ws';
import {
  createRuntimeState,
  mapMessagesToUi,
  mergeStreamMessages,
  reduceRuntime,
} from '@/lib/aioncore/chat-reducer';
import { chatLog, chatWarn } from '@/lib/aioncore/logger';

export function useAioncoreChat() {
  const [messages, setMessages] = useState([]);
  const [runtime, setRuntime] = useState(createRuntimeState);
  const clientRef = useRef(null);
  const conversationIdRef = useRef(null);
  const frameRef = useRef(null);
  const queueRef = useRef([]);

  const applyRuntimeEvent = useCallback((name, payload) => {
    setRuntime((previous) => {
      const next = reduceRuntime(previous, name, payload);
      chatLog('runtime', `${name}: ${previous.state}/${previous.isProcessing} -> ${next.state}/${next.isProcessing}`, payload);
      return next;
    });
  }, []);

  const flushMessageQueue = useCallback(() => {
    frameRef.current = null;
    const queued = queueRef.current.splice(0);
    if (!queued.length) return;
    chatLog('messages', `merging ${queued.length} stream event(s)`);
    setMessages((previous) => queued.reduce(mergeStreamMessages, previous));
  }, []);

  useEffect(() => {
    const client = createAioncoreRealtimeClient();
    clientRef.current = client;
    const subscriptions = [
      client.on('realtime.connected', () => applyRuntimeEvent('realtime.connected', {})),
      client.on('realtime.disconnected', (payload) => {
        applyRuntimeEvent('realtime.disconnected', payload);
      }),
      client.on('realtime.reconnected', (payload) => {
        applyRuntimeEvent('realtime.reconnected', payload);
        if (conversationIdRef.current) {
          client.send('chat:history:load', { conversation_id: conversationIdRef.current });
        }
      }),
      client.on('session:state', (payload) => {
        if (payload?.conversation_id && !conversationIdRef.current) {
          conversationIdRef.current = payload.conversation_id;
        }
      }),
      client.on('chat:history:page', (payload) => {
        if (Array.isArray(payload?.items)) {
          chatLog('history', `loaded ${payload.items.length} message(s)`, payload);
          setMessages(payload.items);
        }
      }),
      client.on('chat:turn:state', (payload) => applyRuntimeEvent('chat:turn:state', payload)),
      client.on('turn.completed', (payload) => applyRuntimeEvent('turn.completed', payload)),
      client.on('message.stream', (payload) => {
        applyRuntimeEvent('message.stream', payload);
        if (conversationIdRef.current && payload.conversation_id && payload.conversation_id !== conversationIdRef.current) return;
        if (!payload?.msg_id) {
          chatLog('messages', `runtime-only stream event ${payload?.type || '(unknown type)'}`, payload);
          return;
        }
        queueRef.current.push(payload);
        if (!frameRef.current) frameRef.current = requestAnimationFrame(flushMessageQueue);
      }),
    ];
    return () => {
      for (const unsubscribe of subscriptions) unsubscribe();
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      client.close();
      clientRef.current = null;
    };
  }, [applyRuntimeEvent, flushMessageQueue]);

  const loadConversation = useCallback((id) => {
    chatLog('conversation', `load ${id}`);
    conversationIdRef.current = id;
    clientRef.current?.send('chat:history:load', { conversation_id: id });
  }, []);

  const waitUntilConnected = useCallback(async () => {
    const client = clientRef.current;
    if (!client) throw new Error('实时连接尚未初始化，请稍后重试');
    await client.ready();
    chatLog('conversation', 'realtime connection confirmed ready');
  }, []);

  const sendMessage = useCallback((text, attachedFile, overrideConversationId = null) => {
    const activeId = overrideConversationId || conversationIdRef.current;
    if (!activeId) {
      chatWarn('conversation', 'send ignored because conversation id is missing');
      return;
    }
    chatLog('conversation', `optimistic send to ${activeId}`, { conversation_id: activeId, attachment: Boolean(attachedFile) });
    conversationIdRef.current = activeId;
    applyRuntimeEvent('local.send', {});
    setMessages((previous) => [
      ...previous,
      {
        role: 'user',
        type: 'text',
        content: { content: text, filename: attachedFile?.name },
        msg_id: `local-user-${crypto.randomUUID()}`,
        conversation_id: activeId,
      },
    ]);
  }, [applyRuntimeEvent]);

  const cancelGeneration = useCallback((overrideConversationId = null) => {
    const activeId = overrideConversationId || conversationIdRef.current;
    if (activeId) {
      chatLog('conversation', `cancel ${activeId}`);
      clientRef.current?.send('chat:cancel', { conversation_id: activeId });
    }
  }, []);

  const uiMessages = useMemo(() => mapMessagesToUi(messages, runtime), [messages, runtime]);

  return {
    messages: uiMessages,
    isProcessing: runtime.isProcessing,
    sendMessage,
    loadConversation,
    waitUntilConnected,
    cancelGeneration,
  };
}
