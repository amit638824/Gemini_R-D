import type { CalendarEvent } from '../shared/types.js';
/**
 * Google Calendar integration.
 * Without OAuth credentials, returns / seeds a local stub so voice flows work.
 */
export declare class CalendarService {
    isConfigured(): boolean;
    listUpcoming(hoursAhead?: number): Promise<CalendarEvent[]>;
    private stubUpcoming;
    private getAccessToken;
}
export declare const calendarService: CalendarService;
