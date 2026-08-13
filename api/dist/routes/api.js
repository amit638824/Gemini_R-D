import { Router } from 'express';
import { stateStore } from '../state/store.js';
import { calendarService } from '../services/calendar.js';
import { tasksService } from '../services/tasks.js';
import { env } from '../config/env.js';
export const apiRouter = Router();
/**
 * @openapi
 * /api/health:
 *   get:
 *     tags: [Health]
 *     summary: Health check
 *     description: Returns process health, Gemini Live model, and Google integration flag.
 *     responses:
 *       200:
 *         description: Service is up
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthResponse'
 */
apiRouter.get('/health', (_req, res) => {
    res.json({
        ok: true,
        model: env.geminiLiveModel,
        apiVersion: env.geminiApiVersion,
        googleConfigured: calendarService.isConfigured(),
    });
});
/**
 * @openapi
 * /api/state:
 *   get:
 *     tags: [State]
 *     summary: Get current day state
 *     description: Activity, timers, notes, orders, tasks, and calendar snapshot used by the voice assistant.
 *     responses:
 *       200:
 *         description: Current day state
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DayState'
 */
apiRouter.get('/state', (_req, res) => {
    res.json(stateStore.get());
});
/**
 * @openapi
 * /api/state/reset:
 *   post:
 *     tags: [State]
 *     summary: Reset activity and timers
 *     description: Clears current/next activity fields and removes all timers. Notes, orders, and tasks are kept.
 *     responses:
 *       200:
 *         description: Updated day state after reset
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DayState'
 */
apiRouter.post('/state/reset', (_req, res) => {
    stateStore.updateActivity({
        current: null,
        next: null,
        locationHint: null,
        notes: null,
    });
    for (const t of stateStore.get().timers) {
        stateStore.removeTimer(t.id);
    }
    res.json(stateStore.get());
});
/**
 * @openapi
 * /api/calendar:
 *   get:
 *     tags: [Calendar]
 *     summary: List upcoming calendar events
 *     description: Uses Google Calendar when OAuth is configured; otherwise returns local stub events.
 *     parameters:
 *       - in: query
 *         name: hours
 *         schema:
 *           type: number
 *           default: 24
 *         description: Hours ahead to include
 *     responses:
 *       200:
 *         description: Upcoming events
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CalendarListResponse'
 */
apiRouter.get('/calendar', async (req, res) => {
    const hours = Number(req.query.hours ?? 24);
    const events = await calendarService.listUpcoming(hours);
    res.json({ events, stub: !calendarService.isConfigured() });
});
/**
 * @openapi
 * /api/tasks:
 *   get:
 *     tags: [Tasks]
 *     summary: List tasks
 *     description: Local task store (mirrored to Google Tasks when configured).
 *     parameters:
 *       - in: query
 *         name: includeDone
 *         schema:
 *           type: string
 *           enum: ['0', '1']
 *           default: '0'
 *         description: Pass `1` to include completed tasks
 *     responses:
 *       200:
 *         description: Task list
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TasksListResponse'
 */
apiRouter.get('/tasks', async (req, res) => {
    const includeDone = req.query.includeDone === '1';
    const tasks = await tasksService.list(includeDone);
    res.json({ tasks, stub: !tasksService.isConfigured() });
});
/**
 * @openapi
 * /api/google/status:
 *   get:
 *     tags: [Google]
 *     summary: Google OAuth configuration status
 *     responses:
 *       200:
 *         description: Whether Calendar/Tasks will hit real Google APIs
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GoogleStatusResponse'
 */
apiRouter.get('/google/status', (_req, res) => {
    res.json({
        configured: calendarService.isConfigured(),
        hint: calendarService.isConfigured()
            ? 'Google Calendar/Tasks will use your refresh token'
            : 'Local stubs active. Add GOOGLE_* env vars for real Calendar/Tasks.',
    });
});
//# sourceMappingURL=api.js.map