/** Shared protocol + day-state types (API ↔ UI). */
export function emptyDayState() {
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
//# sourceMappingURL=types.js.map