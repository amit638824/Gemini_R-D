import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { assertGeminiKey, env } from './config/env.js';
import { apiRouter } from './routes/api.js';
import { attachLiveWebSocket } from './ws/liveProxy.js';

assertGeminiKey();

const app = express();
app.use(
  cors({
    origin: env.clientOrigin,
  }),
);
app.use(express.json({ limit: '2mb' }));
app.use('/api', apiRouter);

const server = http.createServer(app);
attachLiveWebSocket(server);

server.listen(env.port, () => {
  console.log(`[server] http://localhost:${env.port}`);
  console.log(`[server] model=${env.geminiLiveModel} api=${env.geminiApiVersion}`);
  console.log(`[server] client origin ${env.clientOrigin}`);
});
