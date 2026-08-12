import type { DayState } from '../shared/types';

function remainingLabel(endsAt: string): string {
  const sec = Math.max(0, Math.round((Date.parse(endsAt) - Date.now()) / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function StatePanel({ state }: { state: DayState }) {
  const activeTimers = state.timers.filter((t) => !t.fired);

  return (
    <aside className="panel state-panel">
      <h2>Day state</h2>

      <section>
        <h3>Now</h3>
        <p>{state.activity.current ?? '—'}</p>
        <h3>Next</h3>
        <p>{state.activity.next ?? '—'}</p>
        {state.activity.locationHint ? (
          <p className="muted">{state.activity.locationHint}</p>
        ) : null}
      </section>

      <section>
        <h3>Timers</h3>
        {activeTimers.length === 0 ? (
          <p className="muted">None</p>
        ) : (
          <ul>
            {activeTimers.map((t) => (
              <li key={t.id}>
                <strong>{t.label}</strong>
                <span>{remainingLabel(t.endsAt)}</span>
                {t.warned ? <em>warned</em> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3>Orders</h3>
        {state.orders.length === 0 ? (
          <p className="muted">None</p>
        ) : (
          <ul>
            {state.orders.slice(0, 5).map((o) => (
              <li key={o.id}>
                {o.customer}: {o.quantity}
                {o.unit ? ` ${o.unit}` : ''}
                {o.dueDate ? ` · ${o.dueDate}` : ''}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3>Tasks</h3>
        {state.tasks.filter((t) => t.status === 'open').length === 0 ? (
          <p className="muted">None</p>
        ) : (
          <ul>
            {state.tasks
              .filter((t) => t.status === 'open')
              .slice(0, 6)
              .map((t) => (
                <li key={t.id}>
                  <span className={`prio prio-${t.priority}`}>{t.priority}</span>
                  {t.title}
                </li>
              ))}
          </ul>
        )}
      </section>

      <section>
        <h3>Notes</h3>
        {state.notes.length === 0 ? (
          <p className="muted">None</p>
        ) : (
          <ul>
            {state.notes.slice(0, 5).map((n) => (
              <li key={n.id}>{n.text}</li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3>Calendar</h3>
        {state.calendar.length === 0 ? (
          <p className="muted">Ask: “What’s on my calendar?”</p>
        ) : (
          <ul>
            {state.calendar.slice(0, 4).map((e) => (
              <li key={e.id}>
                {e.title}
                <span className="muted">
                  {new Date(e.start).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  );
}
