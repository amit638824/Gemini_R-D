import { v4 as uuid } from 'uuid';
import { stateStore } from '../state/store.js';
import { timerScheduler } from '../scheduler/timerScheduler.js';
import { calendarService } from '../services/calendar.js';
import { tasksService } from '../services/tasks.js';
import { notesService } from '../services/notes.js';
function num(value) {
    if (typeof value === 'number' && Number.isFinite(value))
        return value;
    if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
        return Number(value);
    }
    return undefined;
}
function str(value) {
    return typeof value === 'string' ? value : undefined;
}
function priorityOf(value) {
    if (value === 'low' || value === 'high' || value === 'medium')
        return value;
    return 'medium';
}
export async function handleToolCall(name, args) {
    let result;
    switch (name) {
        case 'update_activity': {
            result = stateStore.updateActivity({
                current: str(args.current) ?? undefined,
                next: str(args.next) ?? undefined,
                locationHint: str(args.locationHint) ?? undefined,
                notes: str(args.notes) ?? undefined,
            });
            break;
        }
        case 'set_timer': {
            const minutes = num(args.duration_minutes) ?? 0;
            const seconds = num(args.duration_seconds) ?? 0;
            const durationSec = Math.max(1, Math.round(minutes * 60 + seconds));
            const warnMinutes = num(args.warn_before_minutes);
            const label = str(args.label) ?? 'current activity';
            // Replace existing same-label / primary timer for simplicity
            timerScheduler.cancel(undefined, label);
            result = timerScheduler.create({
                label,
                durationSec,
                warnBeforeSec: warnMinutes !== undefined ? Math.round(warnMinutes * 60) : undefined,
            });
            break;
        }
        case 'extend_timer': {
            const addMin = num(args.add_minutes);
            const setMin = num(args.set_remaining_minutes);
            result = timerScheduler.extendOrSet({
                label: str(args.label),
                timerId: str(args.timer_id),
                addSec: addMin !== undefined ? Math.round(addMin * 60) : undefined,
                setRemainingSec: setMin !== undefined ? Math.round(setMin * 60) : undefined,
            });
            break;
        }
        case 'cancel_timer': {
            result = {
                cancelled: timerScheduler.cancel(str(args.timer_id), str(args.label)),
            };
            break;
        }
        case 'save_note': {
            result = notesService.save({
                text: str(args.text) ?? '',
                tags: Array.isArray(args.tags)
                    ? args.tags.filter((t) => typeof t === 'string')
                    : [],
            });
            break;
        }
        case 'save_order': {
            result = notesService.saveOrder({
                customer: str(args.customer) ?? 'Unknown',
                quantity: num(args.quantity) ?? 0,
                unit: str(args.unit),
                dueDate: str(args.due_date),
                raw: str(args.raw) ?? str(args.customer) ?? '',
            });
            break;
        }
        case 'create_task': {
            result = await tasksService.create({
                title: str(args.title) ?? 'Untitled',
                due: str(args.due),
                priority: priorityOf(args.priority),
            });
            break;
        }
        case 'list_tasks': {
            result = await tasksService.list(Boolean(args.include_done));
            break;
        }
        case 'prioritize_tasks': {
            const tasks = await tasksService.list(false);
            const rank = {
                high: 0,
                medium: 1,
                low: 2,
            };
            const sorted = [...tasks].sort((a, b) => {
                const pr = rank[a.priority] - rank[b.priority];
                if (pr !== 0)
                    return pr;
                const ad = a.due ? Date.parse(a.due) : Number.POSITIVE_INFINITY;
                const bd = b.due ? Date.parse(b.due) : Number.POSITIVE_INFINITY;
                return ad - bd;
            });
            result = {
                criteria: str(args.criteria) ?? 'priority then due date',
                ordered: sorted,
                suggestion: sorted[0]
                    ? `Lead with "${sorted[0].title}" (${sorted[0].priority}).`
                    : 'No open tasks.',
            };
            break;
        }
        case 'list_calendar': {
            const hours = num(args.hours_ahead) ?? 24;
            result = await calendarService.listUpcoming(hours);
            break;
        }
        case 'get_day_state': {
            result = stateStore.get();
            break;
        }
        default:
            result = { error: `Unknown tool: ${name}` };
    }
    const event = { name, args, result };
    return { result, event };
}
export function toolResponsePayload(id, name, result) {
    return {
        id: id || uuid(),
        name,
        response: { result },
    };
}
//# sourceMappingURL=handlers.js.map