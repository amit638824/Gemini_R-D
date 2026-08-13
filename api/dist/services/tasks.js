import { v4 as uuid } from 'uuid';
import { env } from '../config/env.js';
import { stateStore } from '../state/store.js';
/**
 * Google Tasks + local fallback.
 */
export class TasksService {
    isConfigured() {
        return Boolean(env.google.clientId &&
            env.google.clientSecret &&
            env.google.refreshToken);
    }
    async create(input) {
        const task = {
            id: uuid(),
            title: input.title,
            due: input.due,
            priority: input.priority,
            status: 'open',
            createdAt: new Date().toISOString(),
        };
        // Always keep local mirror for day-state / voice context
        stateStore.addTask(task);
        if (this.isConfigured()) {
            try {
                await this.pushToGoogle(task);
            }
            catch (err) {
                console.warn('[tasks] Google push failed; kept locally', err);
            }
        }
        return task;
    }
    async list(includeDone = false) {
        const tasks = stateStore.get().tasks;
        return includeDone ? tasks : tasks.filter((t) => t.status === 'open');
    }
    async pushToGoogle(task) {
        const accessToken = await this.getAccessToken();
        // Use default task list (@default)
        const res = await fetch('https://tasks.googleapis.com/tasks/v1/lists/@default/tasks', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                title: task.title,
                due: task.due
                    ? new Date(task.due).toISOString()
                    : undefined,
                notes: `priority:${task.priority}`,
            }),
        });
        if (!res.ok) {
            throw new Error(`Tasks API ${res.status}: ${await res.text()}`);
        }
    }
    async getAccessToken() {
        const body = new URLSearchParams({
            client_id: env.google.clientId,
            client_secret: env.google.clientSecret,
            refresh_token: env.google.refreshToken,
            grant_type: 'refresh_token',
        });
        const res = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body,
        });
        if (!res.ok)
            throw new Error(await res.text());
        const data = (await res.json());
        return data.access_token;
    }
}
export const tasksService = new TasksService();
//# sourceMappingURL=tasks.js.map