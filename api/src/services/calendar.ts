import type { CalendarEvent } from '../shared/types.js';
import { v4 as uuid } from 'uuid';
import { env } from '../config/env.js';
import { stateStore } from '../state/store.js';

/**
 * Google Calendar integration.
 * Without OAuth credentials, returns / seeds a local stub so voice flows work.
 */
export class CalendarService {
  isConfigured(): boolean {
    return Boolean(
      env.google.clientId &&
        env.google.clientSecret &&
        env.google.refreshToken,
    );
  }

  async listUpcoming(hoursAhead = 24): Promise<CalendarEvent[]> {
    if (!this.isConfigured()) {
      return this.stubUpcoming(hoursAhead);
    }

    // Minimal Calendar API via refresh token
    try {
      const accessToken = await this.getAccessToken();
      const timeMin = new Date().toISOString();
      const timeMax = new Date(
        Date.now() + hoursAhead * 3600 * 1000,
      ).toISOString();
      const url = new URL(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      );
      url.searchParams.set('timeMin', timeMin);
      url.searchParams.set('timeMax', timeMax);
      url.searchParams.set('singleEvents', 'true');
      url.searchParams.set('orderBy', 'startTime');
      url.searchParams.set('maxResults', '10');

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        throw new Error(`Calendar API ${res.status}: ${await res.text()}`);
      }
      const data = (await res.json()) as {
        items?: Array<{
          id?: string;
          summary?: string;
          location?: string;
          start?: { dateTime?: string; date?: string };
          end?: { dateTime?: string; date?: string };
        }>;
      };

      const events: CalendarEvent[] = (data.items ?? []).map((item) => ({
        id: item.id ?? uuid(),
        title: item.summary ?? 'Untitled',
        start: item.start?.dateTime ?? item.start?.date ?? '',
        end: item.end?.dateTime ?? item.end?.date ?? '',
        location: item.location,
      }));
      stateStore.setCalendar(events);
      return events;
    } catch (err) {
      console.warn('[calendar] falling back to stub', err);
      return this.stubUpcoming(hoursAhead);
    }
  }

  private stubUpcoming(hoursAhead: number): CalendarEvent[] {
    const existing = stateStore.get().calendar;
    if (existing.length) {
      return existing.filter((e) => {
        const t = Date.parse(e.start);
        return t >= Date.now() && t <= Date.now() + hoursAhead * 3600 * 1000;
      });
    }

    const seeded: CalendarEvent[] = [
      {
        id: uuid(),
        title: 'Follow-up calls (stub)',
        start: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
        end: new Date(Date.now() + 3 * 3600 * 1000).toISOString(),
        location: 'Phone',
      },
      {
        id: uuid(),
        title: 'Payment allocation review (stub)',
        start: new Date(Date.now() + 5 * 3600 * 1000).toISOString(),
        end: new Date(Date.now() + 5.5 * 3600 * 1000).toISOString(),
      },
    ];
    stateStore.setCalendar(seeded);
    return seeded;
  }

  private async getAccessToken(): Promise<string> {
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
    if (!res.ok) {
      throw new Error(`Token refresh failed: ${await res.text()}`);
    }
    const data = (await res.json()) as { access_token: string };
    return data.access_token;
  }
}

export const calendarService = new CalendarService();
