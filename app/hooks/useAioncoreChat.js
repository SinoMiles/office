'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createAioncoreRealtimeClient } from '@/lib/api/aioncore-ws';
import {
  createRuntimeState,
  mapMessagesToUi,
  mergeStreamMessages,
  reduceRuntime,
} from '@/lib/aioncore/chat-reducer';

export function useAioncoreChat() {
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [runtime, setRuntime] = useState(createRuntimeState);
  const clientRef = useRef(null);
  const conversationIdRef = useRef(null);
  const frameRef = useRef(null);
  const queueRef = useRef([]);

  const applyRuntimeEvent = useCallback((name, payload) => {
    setRuntime((previous) => reduceRuntime(previous, name, payload));
  }, []);

  const flushMessageQueue = useCallback(() => {
    frameRef.current = null;
    const queued = queueRef.current.splice(0);
    if (!queued.length) return;
    setMessages((previous) => queued.reduce(mergeStreamMessages, previous));
  }, []);

  useEffect(() => {
    const client = createAioncoreRealtimeClient();
    clientRef.current = client;
    const subscriptions = [
      client.on('realtime.connected', () => setIsConnected(true)),
      client.on('realtime.disconnected', (payload) => {
        setIsConnected(false);
        applyRuntimeEvent('realtime.disconnected', payload);
      }),
      client.on('realtime.reconnected', (payload) => {
        setIsConnected(true);
        applyRuntimeEvent('realtime.reconnected', payload);
        if (conversationIdRef.current) {
          client.send('chat:history:load', { conversation_id: conversationIdRef.current });
        }
      }),
      client.on('session:state', (payload) => {
        setIsConnected(true);
        if (payload?.conversation_id && !conversationIdRef.current) {
          conversationIdRef.current = payload.conversation_id;
          setConversationId(payload.conversation_id);
        }
      }),
      client.on('chat:history:page', (payload) => {
        if (Array.isArray(payload?.items)) setMessages(payload.items);
      }),
      client.on('chat:turn:state', (payload) => applyRuntimeEvent('chat:turn:state', payload)),
      client.on('message.stream', (payload) => {
        if (!payload?.msg_id) return;
        if (conversationIdRef.current && payload.conversation_id && payload.conversation_id !== conversationIdRef.current) return;
        queueRef.current.push(payload);
        applyRuntimeEvent('message.stream', payload);
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
    conversationIdRef.current = id;
    setConversationId(id);
    clientRef.current?.send('chat:history:load', { conversation_id: id });
  }, []);

  const sendMessage = useCallback((text, attachedFile, overrideConversationId = null) => {
    const activeId = overrideConversationId || conversationIdRef.current;
    if (!activeId) return;
    conversationIdRef.current = activeId;
    setConversationId(activeId);
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

  const stopGeneration = useCallback(() => {
    if (conversationIdRef.current) clientRef.current?.send('chat:stop', { conversation_id: conversationIdRef.current });
  }, []);

  const cancelGeneration = useCallback((overrideConversationId = null) => {
    const activeId = overrideConversationId || conversationIdRef.current;
    if (activeId) clientRef.current?.send('chat:cancel', { conversation_id: activeId });
  }, []);

  const uiMessages = useMemo(() => mapMessagesToUi(messages, runtime), [messages, runtime]);

  return {
    messages: uiMessages,
    rawMessages: messages,
    conversationId,
    isConnected,
    isProcessing: runtime.isProcessing,
    runtime,
    sendMessage,
    loadConversation,
    stopGeneration,
    cancelGeneration,
  };
}
