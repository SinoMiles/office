const ws = new WebSocket('ws://127.0.0.1:9123/ws');

ws.addEventListener('open', () => {
  console.log('WS OPENED');
  ws.send(JSON.stringify({ name: 'session:subscribe', data: { conversation_id: '82156a25' } }));
  ws.send(JSON.stringify({ name: 'ping', data: {} }));
});

ws.addEventListener('message', (event) => {
  console.log('WS MESSAGE:', event.data);
});

ws.addEventListener('close', () => {
  console.log('WS CLOSED');
});

ws.addEventListener('error', (event) => {
  console.error('WS ERROR');
});
