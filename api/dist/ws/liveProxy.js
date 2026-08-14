import { WebSocketServer, WebSocket } from 'ws';
import { LiveSessionManager } from '../live/sessionManager.js';
import { assertGeminiKey, env } from '../config/env.js';
function send(ws, msg) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
    }
}
export function attachLiveWebSocket(server) {
    const wss = new WebSocketServer({ server, path: '/ws/live' });
    wss.on('connection', (ws, _req) => {
        assertGeminiKey();
        let manager = null;
        const emit = (msg) => send(ws, msg);
        void (async () => {
            try {
                if (!env.geminiApiKey ||
                    env.geminiApiKey === 'your_gemini_api_key_here' ||
                    env.geminiApiKey === 'missing') {
                    send(ws, {
                        type: 'error',
                        message: 'GEMINI_API_KEY missing. Copy .env.example to .env and set your key.',
                    });
                    send(ws, { type: 'status', status: 'error', detail: 'no api key' });
                    return;
                }
                manager = new LiveSessionManager(emit);
                await manager.connect();
            }
            catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                console.error('[ws] connect failed', message);
                send(ws, { type: 'error', message });
                send(ws, { type: 'status', status: 'error', detail: message });
            }
        })();
        ws.on('message', (raw) => {
            void (async () => {
                if (!manager)
                    return;
                try {
                    const msg = JSON.parse(String(raw));
                    switch (msg.type) {
                        case 'audio':
                            await manager.sendAudioBase64(msg.data);
                            break;
                        case 'text':
                            await manager.sendText(msg.text);
                            break;
                        case 'audio_stream_end':
                            await manager.sendAudioStreamEnd();
                            break;
                        case 'ping':
                            send(ws, { type: 'pong' });
                            break;
                        default:
                            break;
                    }
                }
                catch (err) {
                    const message = err instanceof Error ? err.message : String(err);
                    send(ws, { type: 'error', message });
                }
            })();
        });
        ws.on('close', () => {
            void manager?.close();
            manager = null;
        });
        ws.on('error', (err) => {
            console.error('[ws] client error', err);
        });
    });
    console.log(`[ws] Live proxy ready on ws://localhost:${env.port}/ws/live`);
    return wss;
}
//# sourceMappingURL=liveProxy.js.map