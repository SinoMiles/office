import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createWebSocketClient } from '@/lib/api/ws';

export function useAioncoreChat() {
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    // Connect directly to the local AionCore engine WebSocket
    const wsUrl = 'ws://127.0.0.1:9123/ws';
    
    const ws = createWebSocketClient(wsUrl);
    wsRef.current = ws;

    const unsubState = ws.on('session:state', (payload) => {
      setIsConnected(true);
      if (payload?.conversation_id && !conversationId) {
        setConversationId(payload.conversation_id);
      }
    });

    const unsubHistory = ws.on('chat:history:page', (payload) => {
      if (payload?.items) {
        setMessages(payload.items);
      }
    });

    let updateQueue = [];
    let isUpdating = false;

    const processQueue = () => {
      if (updateQueue.length === 0) {
        isUpdating = false;
        return;
      }
      
      const queue = [...updateQueue];
      updateQueue = [];
      let shouldStopProcessing = false;

      setMessages(prev => {
        let next = [...prev];
        
        for (const payload of queue) {
          if (!payload?.msg_id) continue;
          if (conversationId && payload.conversation_id && payload.conversation_id !== conversationId) continue;

          if (payload.status === 'finished' || payload.type === 'finish' || payload.status === 'error' || payload.data?.type === 'error' || payload.type === 'error') {
            shouldStopProcessing = true;
          }

          if (payload.type === 'acp_permission' || payload.type === 'permission') {
            const callId = payload.data?.call_id || payload.content?.call_id;
            if (callId) {
              fetch(`http://127.0.0.1:9123/api/conversations/${payload.conversation_id}/confirmations/${encodeURIComponent(callId)}/confirm`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  msg_id: payload.msg_id,
                  data: 'proceed_always',
                  always_allow: true
                })
              }).catch(err => console.error('Failed to auto-approve permission:', err));
            }
            continue;
          }

          // Custom matching for tool calls to prevent overwriting different tools in the same msg_id
          let exists = -1;
          if (payload.type === 'tool_call' || payload.type === 'acp_tool_call') {
            const incomingCallId = payload.data?.call_id || payload.data?.update?.tool_call_id;
            exists = next.findIndex(m => m.msg_id === payload.msg_id && m.type === payload.type && (m.data?.call_id === incomingCallId || m.data?.update?.tool_call_id === incomingCallId));
          } else {
            exists = next.findIndex(m => m.msg_id === payload.msg_id && m.type === payload.type);
          }
          
          if (exists >= 0) {
            const last = next[exists];
            if (payload.type === 'text' || payload.type === 'thinking' || payload.type === 'content') {
              next[exists] = {
                ...last,
                ...payload,
                content: {
                  ...last.content,
                  ...payload.content,
                  content: (last.content?.content || '') + (payload.content?.content || payload.data?.content || ''),
                  subject: payload.content?.subject || last.content?.subject || payload.data?.subject,
                  status: payload.data?.status || payload.content?.status || last.content?.status
                }
              };
            } else if (payload.type === 'tool_group') {
              const existingTools = last.content || [];
              const newToolsMap = new Map((payload.content || []).map(t => [t.call_id, t]));
              const mergedTools = existingTools.map(t => newToolsMap.has(t.call_id) ? { ...t, ...newToolsMap.get(t.call_id) } : t);
              payload.content?.forEach(t => {
                if (!existingTools.find(ext => ext.call_id === t.call_id)) mergedTools.push(t);
              });
              next[exists] = { ...last, ...payload, content: mergedTools };
            } else {
              next[exists] = { ...last, ...payload, data: { ...last.data, ...payload.data } };
            }
          } else {
            next.push(payload);
          }
        }
        return next;
      });
      
      if (shouldStopProcessing) {
        setIsProcessing(false);
      }
      
      requestAnimationFrame(processQueue);
    };

    const unsubMessage = ws.on('message.stream', (payload) => {
      fetch('/api/debug', { method: 'POST', body: JSON.stringify(payload) }).catch(() => null);
      updateQueue.push(payload);
      if (!isUpdating) {
        isUpdating = true;
        requestAnimationFrame(processQueue);
      }
    });

    const unsubTurnState = ws.on('chat:turn:state', (payload) => {
      setIsProcessing(payload?.state === 'generating');
    });

    return () => {
      unsubState();
      unsubHistory();
      unsubMessage();
      unsubTurnState();
      ws.close();
    };
  }, [conversationId]);

  const loadConversation = useCallback((id) => {
    setConversationId(id);
    if (wsRef.current) {
      wsRef.current.send('chat:history:load', { conversation_id: id });
    }
  }, []);

  // Map AionCore's message types to OfficeWeb's existing UI format
  const uiMessages = useMemo(() => {
    const mappedMessages = [];
    let currentAiMsg = null;

    messages.forEach((msg) => {
      if (msg.role === 'user') {
        if (currentAiMsg) {
          mappedMessages.push(currentAiMsg);
          currentAiMsg = null;
        }
        mappedMessages.push({
          role: 'user',
          content: msg.content?.content || msg.content || '',
          filename: msg.content?.filename // Optional based on attachments
        });
      } else {
        if (!currentAiMsg) currentAiMsg = { role: 'ai', content: '', loading: isProcessing };
        
        if (msg.type === 'thinking') {
          currentAiMsg.thought = {
            subject: msg.content?.subject || '思考中',
            description: msg.content?.content, // AionCore stores the thinking text in content.content
            done: msg.content?.status === 'done' || msg.status === 'finish' || msg.status === 'completed' || !isProcessing
          };
        } else if (msg.type === 'tool_group' || msg.type === 'tool_call' || msg.type === 'acp_tool_call') {
          if (!currentAiMsg.progress) currentAiMsg.progress = { subject: '正在处理任务', startedAt: Date.now(), steps: [] };
          
          const payloadData = msg.data || msg.content || {};
          
          if (msg.type === 'tool_group') {
            (payloadData.content || payloadData).forEach?.(tool => {
              currentAiMsg.progress.steps.push({
                id: tool.call_id,
                title: tool.description || tool.name,
                status: tool.status === 'Success' ? 'completed' : tool.status === 'Error' ? 'failed' : 'running'
              });
            });
          } else if (msg.type === 'tool_call') {
            currentAiMsg.progress.steps.push({
              id: payloadData.call_id,
              title: payloadData.description || payloadData.name,
              status: payloadData.status === 'completed' ? 'completed' : payloadData.status === 'error' ? 'failed' : 'running'
            });
          } else if (msg.type === 'acp_tool_call') {
            const update = payloadData.update || {};
            currentAiMsg.progress.steps.push({
              id: update.tool_call_id,
              title: update.server_name ? `调用 ${update.server_name} 插件` : '执行插件任务',
              status: update.status === 'completed' ? 'completed' : update.status === 'error' ? 'failed' : 'running'
            });
          }
          
          const allStepsCompleted = currentAiMsg.progress.steps.every(s => s.status === 'completed' || s.status === 'failed');
          currentAiMsg.progress.done = !isProcessing || allStepsCompleted;
        } else if (msg.type === 'text' || msg.type === 'content') {
          currentAiMsg.content = msg.content?.content || msg.content || '';
        } else if (msg.type === 'error' || (msg.type === 'tips' && msg.status === 'error')) {
          currentAiMsg.content = `[系统提示] 发生错误: ${msg.data?.detail || msg.data?.message || msg.data?.content || msg.content?.content || msg.data?.details || '未知错误'}`;
          currentAiMsg.isError = true;
          currentAiMsg.loading = false;
          if (currentAiMsg.thought) currentAiMsg.thought.done = true;
        }
      }
    });

    if (currentAiMsg) {
      mappedMessages.push(currentAiMsg);
    }
    
    return mappedMessages;
  }, [messages, isProcessing]);

  const sendMessage = useCallback((text, attachedFile, overrideConvId = null) => {
    if (!wsRef.current) return;
    const activeConvId = overrideConvId || conversationId;
    if (!activeConvId) {
      console.warn('Cannot send message: conversationId is null');
      return;
    }
    setIsProcessing(true);
    setConversationId(activeConvId);
    // Add optimistic user message
    const msgId = `user_${Date.now()}`;
    setMessages(prev => [...prev, { role: 'user', type: 'text', content: { content: text, filename: attachedFile?.name }, msg_id: msgId }]);
    
    // Note: The actual request to AionCore is now triggered via HTTP POST in /api/process,
    // so we just wait for the WebSocket to stream the response back.
  }, [conversationId]);

  const stopGeneration = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.send('chat:stop', { conversation_id: conversationId });
    }
  }, [conversationId]);

  const cancelGeneration = useCallback((overrideConvId = null) => {
    if (!wsRef.current) return;
    const activeConvId = overrideConvId || conversationId;
    if (activeConvId) {
      wsRef.current.send('chat:cancel', { conversation_id: activeConvId });
    }
  }, [conversationId]);

  return {
    messages: uiMessages,
    rawMessages: messages,
    conversationId,
    isConnected,
    isProcessing,
    sendMessage,
    loadConversation,
    stopGeneration,
    cancelGeneration
  };
}
