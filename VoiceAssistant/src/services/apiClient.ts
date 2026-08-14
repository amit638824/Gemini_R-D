import { DayState } from '../shared/types';
import { AppStorage } from '../utils/storage';

function getHttpBaseUrl(): string {
  return AppStorage.getHttpBaseUrl();
}

export interface CalendarEventItem {
  id: string;
  title: string;
  start: string;
  end: string;
  location?: string;
  description?: string;
}

export interface TaskItem {
  id: string;
  title: string;
  status: 'open' | 'done';
  priority: 'low' | 'med' | 'high';
  due?: string;
}

export const ApiClient = {
  async fetchHealth(): Promise<{ ok: boolean; model: string; googleConfigured: boolean }> {
    try {
      const res = await fetch(`${getHttpBaseUrl()}/api/health`);
      return await res.json();
    } catch (e) {
      console.warn('[ApiClient] fetchHealth failed:', e);
      return { ok: false, model: 'unknown', googleConfigured: false };
    }
  },

  async fetchDayState(): Promise<DayState | null> {
    try {
      const res = await fetch(`${getHttpBaseUrl()}/api/state`);
      if (!res.ok) return null;
      return (await res.json()) as DayState;
    } catch (e) {
      console.warn('[ApiClient] fetchDayState failed:', e);
      return null;
    }
  },

  async fetchCalendar(hours = 24): Promise<CalendarEventItem[]> {
    try {
      const res = await fetch(`${getHttpBaseUrl()}/api/calendar?hours=${hours}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.events || [];
    } catch (e) {
      console.warn('[ApiClient] fetchCalendar failed:', e);
      return [];
    }
  },

  async fetchTasks(includeDone = false): Promise<TaskItem[]> {
    try {
      const res = await fetch(`${getHttpBaseUrl()}/api/tasks?includeDone=${includeDone ? '1' : '0'}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.tasks || [];
    } catch (e) {
      console.warn('[ApiClient] fetchTasks failed:', e);
      return [];
    }
  },

  async resetDayState(): Promise<DayState | null> {
    try {
      const res = await fetch(`${getHttpBaseUrl()}/api/state/reset`, { method: 'POST' });
      if (!res.ok) return null;
      return (await res.json()) as DayState;
    } catch (e) {
      console.warn('[ApiClient] resetDayState failed:', e);
      return null;
    }
  },
};
