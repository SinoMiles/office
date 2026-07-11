import { chatError, chatLog, chatWarn } from '@/lib/aioncore/logger';

export function createAioncoreRealtimeClient(options = {}) {
  const listeners = new Map();
  const outbound = [];
  let socket = null;
  let closed = false;
  let reconnectTimer = null;
  let reconnectAttempt = 0;

  const emit = (name, data) => {
    for (const listener of listeners.get(name) || []) listener(data);
  };

  const scheduleReconnect = () => {
    if (closed || reconnectTimer) return;
    const delay = Math.min(500 * 2 ** reconnectAttempt, options.maxReconnectDelayMs || 8000);
    reconnectAttempt += 1;
    chatWarn('ws', `reconnect scheduled in ${delay}ms (attempt ${reconnectAttempt})`);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  };

  const connect = () => {
    if (closed || socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}/ws`;
    chatLog('ws', `connecting ${url}`);
    const current = new WebSocket(url);
    socket = current;
    current.addEventListener('open', () => {
      const reconnected = reconnectAttempt > 0;
      reconnectAttempt = 0;
      chatLog('ws', reconnected ? 'reconnected' : 'connected');
      chatLog('ws', `flushing ${outbound.length} queued outbound event(s)`);
      while (outbound.length) current.send(JSON.stringify(outbound.shift()));
      emit(reconnected ? 'realtime.reconnected' : 'realtime.connected', {});
    });
    current.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(String(event.data));
        const name = message.name || message.event;
        const data = message.data !== undefined ? message.data : message.payload;
        chatLog('ws:in', name || 'unnamed event', data);
        if (name === 'ping') {
          current.send(JSON.stringify({ name: 'pong', data: { timestamp: Date.now() } }));
          return;
        }
        if (name) emit(name, data);
      } catch (error) {
        chatError('ws:in', 'malformed backend frame', error);
      }
    });
    current.addEventListener('close', (event) => {
      chatWarn('ws', `closed code=${event.code} reason=${event.reason || '(none)'}`);
      if (socket === current) socket = null;
      if (!closed) {
        emit('realtime.disconnected', {});
        scheduleReconnect();
      }
    });
    current.addEventListener('error', (error) => {
      chatError('ws', 'socket error', error);
      current.close();
    });
  };

  connect();
  return {
    on(name, listener) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(listener);
      return () => listeners.get(name)?.delete(listener);
    },
    send(name, data) {
      const message = { name, data };
      if (socket?.readyState === WebSocket.OPEN) {
        chatLog('ws:out', name, data);
        socket.send(JSON.stringify(message));
      } else {
        chatWarn('ws:out', `queued ${name}; socket is not open`, data);
        outbound.push(message);
      }
    },
    close() {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      chatLog('ws', 'client closed intentionally');
      socket?.close();
    },
  };
}
