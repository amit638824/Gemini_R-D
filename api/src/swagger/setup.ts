import path from 'node:path';
import { fileURLToPath } from 'node:url';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import type { Express } from 'express';
import { env } from '../config/env.js';

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const wsPublic = env.publicUrl.replace(/^http/, 'ws');

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Chief of Staff API',
      version: '0.1.0',
      description: [
        'REST + Gemini Live WebSocket API for a hands-free personal AI Chief of Staff.',
        '',
        '## Live voice (WebSocket)',
        `Connect to \`${wsPublic}/ws/live\` (prod) or \`ws://localhost:${env.port}/ws/live\` (local).`,
        '',
        '### Client → Server',
        '- `{ "type": "audio", "data": "<base64 PCM 16kHz>" }`',
        '- `{ "type": "text", "text": "..." }`',
        '- `{ "type": "audio_stream_end" }`',
        '- `{ "type": "ping" }`',
        '',
        '### Server → Client',
        '- `ready` / `state` / `audio` / `transcript` / `tool` / `status` / `interrupted` / `error` / `pong`',
        '',
        'Proactive timers are managed server-side; when a warn/fire fires, the API injects a speak prompt into the open Live session.',
      ].join('\n'),
    },
    servers: [
      {
        url: env.publicUrl,
        description: 'Production (apigemini.techwagger.com)',
      },
      {
        url: `http://localhost:${env.port}`,
        description: 'Local API',
      },
    ],
    tags: [
      { name: 'Health', description: 'Service status' },
      { name: 'State', description: 'Day activity, timers, notes, orders' },
      { name: 'Calendar', description: 'Google Calendar or local stub' },
      { name: 'Tasks', description: 'Google Tasks or local store' },
      { name: 'Google', description: 'OAuth / integration status' },
      { name: 'Live', description: 'Gemini Live WebSocket (documented below)' },
    ],
    components: {
      schemas: {
        HealthResponse: {
          type: 'object',
          properties: {
            ok: { type: 'boolean', example: true },
            model: { type: 'string', example: 'gemini-3.1-flash-live-preview' },
            apiVersion: { type: 'string', example: 'v1beta' },
            googleConfigured: { type: 'boolean', example: false },
          },
        },
        ActivityContext: {
          type: 'object',
          properties: {
            current: { type: 'string', nullable: true },
            next: { type: 'string', nullable: true },
            locationHint: { type: 'string', nullable: true },
            notes: { type: 'string', nullable: true },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        TimerState: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            label: { type: 'string' },
            totalSec: { type: 'integer' },
            endsAt: { type: 'string', format: 'date-time' },
            warnBeforeSec: { type: 'integer' },
            warned: { type: 'boolean' },
            fired: { type: 'boolean' },
          },
        },
        NoteItem: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            text: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        OrderItem: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            customer: { type: 'string' },
            quantity: { type: 'number' },
            unit: { type: 'string' },
            dueDate: { type: 'string' },
            raw: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        TaskItem: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            due: { type: 'string' },
            priority: { type: 'string', enum: ['low', 'medium', 'high'] },
            status: { type: 'string', enum: ['open', 'done'] },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        CalendarEvent: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            start: { type: 'string', format: 'date-time' },
            end: { type: 'string', format: 'date-time' },
            location: { type: 'string' },
          },
        },
        DayState: {
          type: 'object',
          properties: {
            activity: { $ref: '#/components/schemas/ActivityContext' },
            timers: {
              type: 'array',
              items: { $ref: '#/components/schemas/TimerState' },
            },
            notes: {
              type: 'array',
              items: { $ref: '#/components/schemas/NoteItem' },
            },
            orders: {
              type: 'array',
              items: { $ref: '#/components/schemas/OrderItem' },
            },
            tasks: {
              type: 'array',
              items: { $ref: '#/components/schemas/TaskItem' },
            },
            calendar: {
              type: 'array',
              items: { $ref: '#/components/schemas/CalendarEvent' },
            },
          },
        },
        CalendarListResponse: {
          type: 'object',
          properties: {
            events: {
              type: 'array',
              items: { $ref: '#/components/schemas/CalendarEvent' },
            },
            stub: {
              type: 'boolean',
              description: 'true when Google OAuth is not configured',
            },
          },
        },
        TasksListResponse: {
          type: 'object',
          properties: {
            tasks: {
              type: 'array',
              items: { $ref: '#/components/schemas/TaskItem' },
            },
            stub: { type: 'boolean' },
          },
        },
        GoogleStatusResponse: {
          type: 'object',
          properties: {
            configured: { type: 'boolean' },
            hint: { type: 'string' },
          },
        },
        LiveClientMessage: {
          oneOf: [
            {
              type: 'object',
              required: ['type', 'data'],
              properties: {
                type: { type: 'string', enum: ['audio'] },
                data: {
                  type: 'string',
                  description: 'Base64 raw PCM 16-bit mono @ 16kHz',
                },
              },
            },
            {
              type: 'object',
              required: ['type', 'text'],
              properties: {
                type: { type: 'string', enum: ['text'] },
                text: { type: 'string' },
              },
            },
            {
              type: 'object',
              required: ['type'],
              properties: {
                type: {
                  type: 'string',
                  enum: ['audio_stream_end', 'ping'],
                },
              },
            },
          ],
        },
        LiveServerMessage: {
          type: 'object',
          required: ['type'],
          properties: {
            type: {
              type: 'string',
              enum: [
                'ready',
                'audio',
                'transcript',
                'interrupted',
                'state',
                'tool',
                'status',
                'error',
                'pong',
              ],
            },
          },
          additionalProperties: true,
        },
      },
    },
    paths: {
      '/ws/live': {
        get: {
          tags: ['Live'],
          summary: 'Gemini Live voice WebSocket',
          description:
            'Upgrade to WebSocket. Not callable from Swagger "Try it out" — use the UI or a WS client. See info description for message shapes.',
          responses: {
            '101': {
              description: 'Switching Protocols (WebSocket)',
            },
          },
        },
      },
    },
  },
  apis: [
    path.join(apiRoot, 'src/routes/**/*.ts'),
    path.join(apiRoot, 'src/swagger/**/*.ts'),
    path.join(apiRoot, 'dist/routes/**/*.js'),
  ],
};

export const swaggerSpec = swaggerJsdoc(options);

export function mountSwagger(app: Express): void {
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'Chief of Staff API Docs',
    explorer: true,
  }));
  app.get('/api/docs.json', (_req, res) => {
    res.json(swaggerSpec);
  });
}
