import type { TimerState } from '../shared/types.js';
export type ReengageHandler = (payload: {
    kind: 'warn' | 'fire';
    timer: TimerState;
    message: string;
}) => void | Promise<void>;
/**
 * Server-side timer engine for proactive re-engagement.
 * Gemini Live cannot wake itself after N minutes — we schedule locally,
 * then inject a speak prompt into the open Live session.
 */
export declare class TimerScheduler {
    private interval;
    private handler;
    start(handler: ReengageHandler): void;
    stop(): void;
    create(input: {
        label: string;
        durationSec: number;
        warnBeforeSec?: number;
    }): TimerState;
    /** Extend/replace remaining time on the matching active timer (or create one). */
    extendOrSet(input: {
        label?: string;
        addSec?: number;
        setRemainingSec?: number;
        timerId?: string;
    }): TimerState;
    cancel(timerId?: string, label?: string): boolean;
    private tick;
}
export declare const timerScheduler: TimerScheduler;
