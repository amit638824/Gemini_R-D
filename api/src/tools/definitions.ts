import type { FunctionDeclaration } from '@google/genai';
import { Type } from '@google/genai';

/** Tool declarations registered with Gemini Live for Chief of Staff. */
export const toolDeclarations: FunctionDeclaration[] = [
  {
    name: 'update_activity',
    description:
      'Update what the user is doing now, what comes next, and optional location/notes.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        current: { type: Type.STRING, description: 'What they are doing now' },
        next: { type: Type.STRING, description: 'What comes next' },
        locationHint: { type: Type.STRING },
        notes: { type: Type.STRING },
      },
    },
  },
  {
    name: 'set_timer',
    description:
      'Start or replace a countdown for the current activity. Use when the user says they will stay/do something for N minutes. The system will proactively re-engage before and when time is up.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        label: {
          type: Type.STRING,
          description: 'Short label, e.g. "staying here"',
        },
        duration_minutes: { type: Type.NUMBER },
        duration_seconds: { type: Type.NUMBER },
        warn_before_minutes: {
          type: Type.NUMBER,
          description: 'Optional early warning, default 5 minutes',
        },
      },
      required: ['label'],
    },
  },
  {
    name: 'extend_timer',
    description:
      'Add time or set remaining time on an active timer (e.g. "give me another 10 minutes").',
    parameters: {
      type: Type.OBJECT,
      properties: {
        add_minutes: { type: Type.NUMBER },
        set_remaining_minutes: { type: Type.NUMBER },
        label: { type: Type.STRING },
        timer_id: { type: Type.STRING },
      },
    },
  },
  {
    name: 'cancel_timer',
    description: 'Cancel an active timer.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        timer_id: { type: Type.STRING },
        label: { type: Type.STRING },
      },
    },
  },
  {
    name: 'save_note',
    description: 'Save a free-form note from voice.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        text: { type: Type.STRING },
        tags: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
      },
      required: ['text'],
    },
  },
  {
    name: 'save_order',
    description:
      'Capture a customer order from voice, e.g. "James ordered 250 units for Thursday".',
    parameters: {
      type: Type.OBJECT,
      properties: {
        customer: { type: Type.STRING },
        quantity: { type: Type.NUMBER },
        unit: { type: Type.STRING },
        due_date: { type: Type.STRING, description: 'Human or ISO date' },
        raw: { type: Type.STRING, description: 'Original utterance' },
      },
      required: ['customer', 'quantity'],
    },
  },
  {
    name: 'create_task',
    description: 'Create a task / Google Tasks item.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        due: { type: Type.STRING },
        priority: {
          type: Type.STRING,
          description: 'low | medium | high',
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'list_tasks',
    description: 'List open tasks, optionally help prioritize.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        include_done: { type: Type.BOOLEAN },
      },
    },
  },
  {
    name: 'prioritize_tasks',
    description:
      'Return open tasks sorted by priority/due for verbal decision support.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        criteria: {
          type: Type.STRING,
          description: 'e.g. due date, revenue impact, urgency',
        },
      },
    },
  },
  {
    name: 'list_calendar',
    description: 'List upcoming Google Calendar events (or local stub).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        hours_ahead: { type: Type.NUMBER },
      },
    },
  },
  {
    name: 'get_day_state',
    description:
      'Get current activity, timers, tasks, orders, notes and calendar snapshot.',
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
];
