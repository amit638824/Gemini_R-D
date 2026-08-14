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
app.use('/api', apiRouter);

const server = http.createServer(app);
attachLiveWebSocket(server);

const isPassenger =
  typeof (globalThis as { PhusionPassenger?: unknown }).PhusionPassenger !==
    'undefined' ||
  process.env.PASSENGER_APP_ENV !== undefined ||
  process.env.PASSENGER_BASE_URI !== undefined;

function onListen(): void {
  console.log(`[server] listening ${isPassenger ? 'passenger' : `${env.host}:${env.port}`}`);
  console.log(`[server] public ${env.publicUrl}`);
  console.log(`[server] docs  ${env.publicUrl}/api/docs`);
  console.log(`[server] model=${env.geminiLiveModel} api=${env.geminiApiVersion}`);
}

if (isPassenger) {
  // cPanel / Phusion Passenger
  server.listen('passenger', onListen);
} else {
  server.listen(env.port, env.host, onListen);
}
