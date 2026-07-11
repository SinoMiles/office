const WebSocket = require('ws');
const ws = new WebSocket('ws://127.0.0.1:9123/ws');
ws.on('open', () => {
  console.log('Connected');
  ws.send(JSON.stringify({ event: 'chat:send', data: { text: "hello" } }));
});
ws.on('message', (msg) => {
  console.log('Received:', msg.toString());
});
setTimeout(() => ws.close(), 2000);
