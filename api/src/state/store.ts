import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  emptyDayState,
  type ActivityContext,
  type CalendarEvent,
  type DayState,
  type NoteItem,
  type OrderItem,
  type TaskItem,
  type TimerState,
} from '../shared/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, '../../data');
const statePath = path.join(dataDir, 'day-state.json');

export type StateListener = (state: DayState) => void;

export class StateStore {
  private state: DayState;
  private listeners = new Set<StateListener>();

  constructor() {
    this.state = this.load();
  }

  get(): DayState {
    return structuredClone(this.state);
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    const snapshot = this.get();
    for (const listener of this.listeners) listener(snapshot);
    this.persist();
  }

  private load(): DayState {
    try {
      if (fs.existsSync(statePath)) {
        return JSON.parse(fs.readFileSync(statePath, 'utf8')) as DayState;
      }
    } catch (err) {
      console.warn('[state] failed to load, using empty state', err);
    }
    return emptyDayState();
  }

  private persist(): void {
    try {
      fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(statePath, JSON.stringify(this.state, null, 2), 'utf8');
    } catch (err) {
      console.warn('[state] persist failed', err);
    }
  }

  updateActivity(partial: Partial<ActivityContext>): ActivityContext {
    this.state.activity = {
      ...this.state.activity,
      ...partial,
      updatedAt: new Date().toISOString(),
    };
    this.emit();
    return this.state.activity;
  }

  upsertTimer(timer: TimerState): TimerState {
    const idx = this.state.timers.findIndex((t) => t.id === timer.id);
    if (idx >= 0) this.state.timers[idx] = timer;
    else this.state.timers.push(timer);
    this.emit();
    return timer;
  }

  patchTimer(id: string, patch: Partial<TimerState>): TimerState | null {
    const timer = this.state.timers.find((t) => t.id === id);
    if (!timer) return null;
    Object.assign(timer, patch);
    this.emit();
    return timer;
  }

  removeTimer(id: string): boolean {
    const before = this.state.timers.length;
    this.state.timers = this.state.timers.filter((t) => t.id !== id);
    if (this.state.timers.length !== before) {
      this.emit();
      return true;
    }
    return false;
  }

  addNote(note: NoteItem): NoteItem {
    this.state.notes.unshift(note);
    this.emit();
    return note;
  }

  addOrder(order: OrderItem): OrderItem {
    this.state.orders.unshift(order);
    this.emit();
    return order;
  }

  addTask(task: TaskItem): TaskItem {
    this.state.tasks.unshift(task);
    this.emit();
    return task;
  }

  updateTask(id: string, patch: Partial<TaskItem>): TaskItem | null {
    const task = this.state.tasks.find((t) => t.id === id);
    if (!task) return null;
    Object.assign(task, patch);
    this.emit();
    return task;
  }

  setCalendar(events: CalendarEvent[]): CalendarEvent[] {
    this.state.calendar = events;
    this.emit();
    return events;
  }

  summarizeForPrompt(): string {
    const s = this.state;
    const lines = [
      `Current activity: ${s.activity.current ?? 'unknown'}`,
      `Next: ${s.activity.next ?? 'unknown'}`,
      `Location hint: ${s.activity.locationHint ?? 'n/a'}`,
      `Activity notes: ${s.activity.notes ?? 'n/a'}`,
    ];

    const activeTimers = s.timers.filter((t) => !t.fired);
    if (activeTimers.length) {
      lines.push('Active timers:');
      for (const t of activeTimers) {
        const remaining = Math.max(
          0,
          Math.round((Date.parse(t.endsAt) - Date.now()) / 1000),
        );
        lines.push(
          `  - ${t.label} (${t.id}): ${remaining}s remaining, ends ${t.endsAt}`,
        );
      }
    } else {
      lines.push('Active timers: none');
    }

    if (s.tasks.filter((t) => t.status === 'open').length) {
      lines.push('Open tasks:');
      for (const t of s.tasks.filter((x) => x.status === 'open').slice(0, 8)) {
        lines.push(
          `  - [${t.priority}] ${t.title}${t.due ? ` (due ${t.due})` : ''}`,
        );
      }
    }

    if (s.orders.length) {
      lines.push('Recent orders:');
      for (const o of s.orders.slice(0, 5)) {
        lines.push(
          `  - ${o.customer}: ${o.quantity}${o.unit ? ' ' + o.unit : ''}${o.dueDate ? ` by ${o.dueDate}` : ''}`,
        );
      }
    }

    if (s.notes.length) {
      lines.push('Recent notes:');
      for (const n of s.notes.slice(0, 5)) {
        lines.push(`  - ${n.text}`);
      }
    }

    if (s.calendar.length) {
      lines.push('Upcoming calendar:');
      for (const e of s.calendar.slice(0, 5)) {
        lines.push(`  - ${e.title} @ ${e.start}`);
      }
    }

    return lines.join('\n');
  }
}

export const stateStore = new StateStore();
