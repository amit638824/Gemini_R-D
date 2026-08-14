import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { assertGeminiKey } from './config/env.js';
import { apiRouter } from './routes/api.js';
import { attachLiveWebSocket } from './ws/liveProxy.js';
import { mountSwagger } from './swagger/setup.js';
assertGeminiKey();
const app = express();
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['*'],
    credentials: false,
}));
app.use(express.json({ limit: '2mb' }));
// Health check endpoints
app.get(['/api/health', '/health'], (_req, res) => {
    res.status(200).json({
        ok: true,
        status: 'healthy',
        service: 'chief-of-staff-api',
        timestamp: new Date().toISOString(),
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
app.use('/api', apiRouter);
app.use('/', apiRouter);
const server = http.createServer(app);
attachLiveWebSocket(server);
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';
server.listen(port, host, () => {
    console.log(`Server running on ${host}:${port}`);
    console.log(`Health: http://${host}:${port}/api/health`);
    console.log(`Docs: http://${host}:${port}/api/docs`);
});
//# sourceMappingURL=index.js.map