import { WebSocketServer } from 'ws';
import type { Server } from 'node:http';
export declare function attachLiveWebSocket(server: Server): WebSocketServer;
