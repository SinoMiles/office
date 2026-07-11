export function createWebSocketClient(url, options = {}) {
  const DEFAULT_OPTIONS = {
    maxReconnectAttempts: Infinity,
    initialReconnectDelayMs: 1000,
    maxReconnectDelayMs: 30000,
    heartbeatIntervalMs: 30000,
  };
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const listeners = new Map();

  let ws = null;
  let closed = false;
  let reconnectAttempt = 0;
  let reconnectTimer = null;
  let heartbeatTimer = null;

  function connect() {
    if (closed) return;
    ws = new WebSocket(url);

    ws.addEventListener('open', () => {
      reconnectAttempt = 0;
      startHeartbeat();
    });

    ws.addEventListener('message', (evt) => {
      try {
        const msg = JSON.parse(String(evt.data));
        const eventName = msg.name || msg.event;
        const payload = msg.data !== undefined ? msg.data : msg.payload;
        
        const handlers = listeners.get(eventName);
        if (handlers) {
          for (const handler of handlers) {
            handler(payload);
          }
        }
      } catch (e) {
        // Ignore malformed
      }
    });

    ws.addEventListener('close', () => {
      stopHeartbeat();
      if (!closed) scheduleReconnect();
    });
  }

  function scheduleReconnect() {
    if (closed || reconnectAttempt >= opts.maxReconnectAttempts) return;
    const delay = Math.min(opts.initialReconnectDelayMs * Math.pow(2, reconnectAttempt), opts.maxReconnectDelayMs);
    reconnectAttempt++;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  }

  function startHeartbeat() {
    stopHeartbeat();
    heartbeatTimer = setInterval(() => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ name: 'ping', data: {} }));
      }
    }, opts.heartbeatIntervalMs);
  }

  function stopHeartbeat() {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }

  connect();

  return {
    on(event, handler) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(handler);
      return () => {
        const set = listeners.get(event);
        if (set) {
          set.delete(handler);
          if (set.size === 0) listeners.delete(event);
        }
      };
    },
    send(event, payload) {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ name: event, data: payload }));
      }
    },
    close() {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      stopHeartbeat();
      if (ws) ws.close();
    }
  };
}
