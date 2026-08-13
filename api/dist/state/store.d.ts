import { type ActivityContext, type CalendarEvent, type DayState, type NoteItem, type OrderItem, type TaskItem, type TimerState } from '../shared/types.js';
export type StateListener = (state: DayState) => void;
export declare class StateStore {
    private state;
    private listeners;
    constructor();
    get(): DayState;
    subscribe(listener: StateListener): () => void;
    private emit;
    private load;
    private persist;
    updateActivity(partial: Partial<ActivityContext>): ActivityContext;
    upsertTimer(timer: TimerState): TimerState;
    patchTimer(id: string, patch: Partial<TimerState>): TimerState | null;
    removeTimer(id: string): boolean;
    addNote(note: NoteItem): NoteItem;
    addOrder(order: OrderItem): OrderItem;
    addTask(task: TaskItem): TaskItem;
    updateTask(id: string, patch: Partial<TaskItem>): TaskItem | null;
    setCalendar(events: CalendarEvent[]): CalendarEvent[];
    summarizeForPrompt(): string;
}
export declare const stateStore: StateStore;
