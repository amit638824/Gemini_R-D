import { v4 as uuid } from 'uuid';
import { env } from '../config/env.js';
import { stateStore } from '../state/store.js';
/**
 * Server-side timer engine for proactive re-engagement.
 * Gemini Live cannot wake itself after N minutes — we schedule locally,
 * then inject a speak prompt into the open Live session.
 */
export class TimerScheduler {
    interval = null;
    handler = null;
    start(handler) {
        this.handler = handler;
        if (this.interval)
            return;
        this.interval = setInterval(() => {
            void this.tick();
        }, 1000);
    }
    stop() {
        if (this.interval)
            clearInterval(this.interval);
        this.interval = null;
    }
    create(input) {
        const warnBeforeSec = input.warnBeforeSec ??
            Math.min(env.timerWarnBeforeSec, Math.max(0, input.durationSec - 1));
        const timer = {
            id: uuid(),
            label: input.label,
            totalSec: input.durationSec,
            endsAt: new Date(Date.now() + input.durationSec * 1000).toISOString(),
            warnBeforeSec,
            warned: warnBeforeSec <= 0,
            fired: false,
        };
        stateStore.upsertTimer(timer);
        return timer;
    }
    /** Extend/replace remaining time on the matching active timer (or create one). */
    extendOrSet(input) {
        const timers = stateStore.get().timers.filter((t) => !t.fired);
        let timer = (input.timerId && timers.find((t) => t.id === input.timerId)) ||
            timers.find((t) => input.label
                ? t.label.toLowerCase() === input.label.toLowerCase()
                : true) ||
            timers[0];
        if (!timer) {
            const duration = input.setRemainingSec ?? input.addSec ?? env.timerWarnBeforeSec;
            return this.create({
                label: input.label ?? 'current activity',
                durationSec: duration,
            });
        }
        const remaining = Math.max(0, Math.round((Date.parse(timer.endsAt) - Date.now()) / 1000));
        let nextRemaining = remaining;
        if (typeof input.setRemainingSec === 'number') {
            nextRemaining = input.setRemainingSec;
        }
        else if (typeof input.addSec === 'number') {
            nextRemaining = remaining + input.addSec;
        }
        const updated = {
            ...timer,
            label: input.label ?? timer.label,
            totalSec: nextRemaining,
            endsAt: new Date(Date.now() + nextRemaining * 1000).toISOString(),
            warned: false,
            fired: false,
            warnBeforeSec: Math.min(timer.warnBeforeSec, Math.max(0, nextRemaining - 1)),
        };
        stateStore.upsertTimer(updated);
        return updated;
    }
    cancel(timerId, label) {
        const timers = stateStore.get().timers.filter((t) => !t.fired);
        const target = (timerId && timers.find((t) => t.id === timerId)) ||
            (label &&
                timers.find((t) => t.label.toLowerCase() === label.toLowerCase())) ||
            timers[0];
        if (!target)
            return false;
        return stateStore.removeTimer(target.id);
    }
    async tick() {
        if (!this.handler)
            return;
        const now = Date.now();
        const timers = stateStore.get().timers.filter((t) => !t.fired);
        for (const timer of timers) {
            const endsAt = Date.parse(timer.endsAt);
            const remainingSec = Math.round((endsAt - now) / 1000);
            if (!timer.warned && remainingSec <= timer.warnBeforeSec && remainingSec > 0) {
                stateStore.patchTimer(timer.id, { warned: true });
                const mins = Math.max(1, Math.round(remainingSec / 60));
                await this.handler({
                    kind: 'warn',
                    timer: { ...timer, warned: true },
                    message: `PROACTIVE RE-ENGAGE NOW. Speak briefly to the user without waiting: ` +
                        `"${mins} minute${mins === 1 ? '' : 's'} left on ${timer.label}." ` +
                        `Then wait for their reply. Current state:\n${stateStore.summarizeForPrompt()}`,
                });
            }
            if (remainingSec <= 0) {
                stateStore.patchTimer(timer.id, { fired: true });
                await this.handler({
                    kind: 'fire',
                    timer: { ...timer, fired: true },
                    message: `PROACTIVE RE-ENGAGE NOW. Speak briefly to the user without waiting: ` +
                        `"Time's up for ${timer.label}." Ask what they want next. ` +
                        `Current state:\n${stateStore.summarizeForPrompt()}`,
                });
            }
        }
    }
}
export const timerScheduler = new TimerScheduler();
//# sourceMappingURL=timerScheduler.js.map