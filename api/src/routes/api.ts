import { Router } from 'express';
import { stateStore } from '../state/store.js';
import { calendarService } from '../services/calendar.js';
import { tasksService } from '../services/tasks.js';
import { env } from '../config/env.js';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => {
  res.json({
    ok: true,
    model: env.geminiLiveModel,
    apiVersion: env.geminiApiVersion,
    googleConfigured: calendarService.isConfigured(),
  });
});

apiRouter.get('/state', (_req, res) => {
  res.json(stateStore.get());
});

apiRouter.post('/state/reset', (_req, res) => {
  // soft reset via empty fields — keep file simple for MVP
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

apiRouter.get('/calendar', async (req, res) => {
  const hours = Number(req.query.hours ?? 24);
  const events = await calendarService.listUpcoming(hours);
  res.json({ events, stub: !calendarService.isConfigured() });
});

apiRouter.get('/tasks', async (req, res) => {
  const includeDone = req.query.includeDone === '1';
  const tasks = await tasksService.list(includeDone);
  res.json({ tasks, stub: !tasksService.isConfigured() });
});

apiRouter.get('/google/status', (_req, res) => {
  res.json({
    configured: calendarService.isConfigured(),
    hint: calendarService.isConfigured()
      ? 'Google Calendar/Tasks will use your refresh token'
      : 'Local stubs active. Add GOOGLE_* env vars for real Calendar/Tasks.',
  });
});
