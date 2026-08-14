/** Shared protocol + day-state types (API ↔ UI matching Gemini_R-D). */

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
      current: 'Reviewing daily schedule',
      next: 'Client sync meeting at 4:00 PM',
      locationHint: 'Office Desk',
      notes: 'Focus on quarterly deliveries',
      updatedAt: new Date().toISOString(),
    },
    timers: [
      {
        id: 't-1',
        label: 'Focus session timer',
        totalSec: 2100,
        endsAt: new Date(Date.now() + 1800 * 1000).toISOString(),
        warnBeforeSec: 300,
        warned: false,
        fired: false,
      },
    ],
    notes: [
      { id: 'n-1', text: 'Confirm invoice details with accounting', tags: ['finance'], createdAt: new Date().toISOString() },
    ],
    orders: [
      { id: 'o-1', customer: 'James', quantity: 250, unit: 'units', dueDate: 'Thursday', raw: '250 units for Thursday', createdAt: new Date().toISOString() },
    ],
    tasks: [
      { id: 'tk-1', title: 'Prepare sales forecast report', priority: 'high', status: 'open', createdAt: new Date().toISOString() },
      { id: 'tk-2', title: 'Review supplier contract draft', priority: 'medium', status: 'open', createdAt: new Date().toISOString() },
    ],
    calendar: [
      { id: 'c-1', title: 'Team Standup & Planning', start: new Date().toISOString(), end: new Date(Date.now() + 1800 * 1000).toISOString(), location: 'Meeting Room 2' },
    ],
  };
}
