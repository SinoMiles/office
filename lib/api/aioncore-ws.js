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
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  };

  const connect = () => {
    if (closed || socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const current = new WebSocket(`${protocol}//${window.location.host}/ws`);
    socket = current;
    current.addEventListener('open', () => {
      const reconnected = reconnectAttempt > 0;
      reconnectAttempt = 0;
      while (outbound.length) current.send(JSON.stringify(outbound.shift()));
      emit(reconnected ? 'realtime.reconnected' : 'realtime.connected', {});
    });
    current.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(String(event.data));
        const name = message.name || message.event;
        const data = message.data !== undefined ? message.data : message.payload;
        if (name === 'ping') {
          current.send(JSON.stringify({ name: 'pong', data: { timestamp: Date.now() } }));
          return;
        }
        if (name) emit(name, data);
      } catch {
        // Ignore malformed backend frames.
      }
    });
    current.addEventListener('close', () => {
      if (socket === current) socket = null;
      if (!closed) {
        emit('realtime.disconnected', {});
        scheduleReconnect();
      }
    });
    current.addEventListener('error', () => current.close());
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
      if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
      else outbound.push(message);
    },
    close() {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    },
  };
}

