/** Shared protocol + day-state types (API ↔ UI). */

export type SessionStatus = 'idle' | 'connecting' | 'live' | 'error';

export interface ActivityContext {
  current: string | null;
  next: string | null;
  locationHint: string | null;
  notes: string | null;
  updatedAt: string;
}

export interface TimerState {
  id: string;
  label: string;
  totalSec: number;
  endsAt: string;
  warnBeforeSec: number;
  warned: boolean;
  fired: boolean;
}

export interface NoteItem {
  id: string;
  text: string;
  tags: string[];
  createdAt: string;
}

export interface OrderItem {
  id: string;
  customer: string;
  quantity: number;
  unit?: string;
  dueDate?: string;
  raw: string;
  createdAt: string;
}

export interface TaskItem {
  id: string;
  title: string;
  due?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'open' | 'done';
  createdAt: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  location?: string;
}

export interface DayState {
  activity: ActivityContext;
  timers: TimerState[];
  notes: NoteItem[];
  orders: OrderItem[];
  tasks: TaskItem[];
  calendar: CalendarEvent[];
}

export type ClientToServerMessage =
  | { type: 'audio'; data: string }
  | { type: 'text'; text: string }
  | { type: 'audio_stream_end' }
  | { type: 'ping' };

export type ServerToClientMessage =
  | { type: 'ready'; state: DayState }
  | { type: 'audio'; data: string; mimeType?: string }
  | { type: 'transcript'; role: 'user' | 'assistant'; text: string; final?: boolean }
  | { type: 'interrupted' }
  | { type: 'state'; state: DayState }
  | { type: 'tool'; name: string; args: unknown; result?: unknown }
  | { type: 'status'; status: SessionStatus; detail?: string }
  | { type: 'error'; message: string }
  | { type: 'pong' };

export function emptyDayState(): DayState {
  return {
    activity: {
      current: null,
      next: null,
      locationHint: null,
      notes: null,
      updatedAt: new Date().toISOString(),
    },
    timers: [],
    notes: [],
    orders: [],
    tasks: [],
    calendar: [],
  };
}
