import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { assertGeminiKey, env } from './config/env.js';
import { apiRouter } from './routes/api.js';
import { attachLiveWebSocket } from './ws/liveProxy.js';
import { mountSwagger } from './swagger/setup.js';

assertGeminiKey();

const app = express();
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['*'],
    credentials: false,
  }),
);
app.use(express.json({ limit: '2mb' }));

// Direct health check endpoints to guarantee instant response on root or /api
app.get(['/api/health', '/health'], (_req, res) => {
  res.status(200).json({
    ok: true,
    status: 'healthy',
    service: 'chief-of-staff-api',
    timestamp: new Date().toISOString(),
    model: env.geminiLiveModel,
  });
});

app.get('/', (_req, res) => {
  res.json({
    ok: true,
    service: 'chief-of-staff-api',
    health: '/api/health',
    docs: '/api/docs',
    live: '/ws/live',
  });
});

mountSwagger(app);

// Support both /api/... and direct /... subpath setups on cPanel
app.use('/api', apiRouter);
app.use('/', apiRouter);

const server = http.createServer(app);
attachLiveWebSocket(server);

const hasGlobalPassenger =
  typeof (globalThis as { PhusionPassenger?: unknown }).PhusionPassenger !==
  'undefined';

const listenTarget = process.env.PORT || env.rawPort || env.port;

function onListen(): void {
  console.log(`[server] listening target=${String(listenTarget)} host=${env.host}`);
  console.log(`[server] public ${env.publicUrl}`);
  console.log(`[server] docs  ${env.publicUrl}/api/docs`);
  console.log(`[server] model=${env.geminiLiveModel} api=${env.geminiApiVersion}`);
}

if (hasGlobalPassenger) {
  // cPanel / Phusion Passenger internal global object
  server.listen('passenger', onListen);
} else if (typeof listenTarget === 'string' && isNaN(Number(listenTarget))) {
  // Passenger socket path passed in process.env.PORT
  server.listen(listenTarget, onListen);
} else {
  // Standard port number (numeric or string representation of a number)
  const portNum = Number(listenTarget) || 3000;
  server.listen(portNum, env.host, onListen);
}
