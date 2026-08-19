import Sheet from './Sheet';
import TaskRow from './TaskRow';
import { useDaytimeState, useStore } from '../store/context';
import {
  NEXT_PRIORITY,
  PRIORITY_COLOR,
  PRIORITY_LABEL,
  domainById,
  tasksForEvent,
} from '../store/selectors';
import { useNow } from '../hooks/useNow';
import type { CalEvent } from '../types';
import { formatDayLabel, formatTime } from '../lib/date';

function when(event: CalEvent): string {
  const start = new Date(event.start);
  const span = event.end
    ? `${formatTime(start)}–${formatTime(new Date(event.end))}`
    : formatTime(start);

  if (event.recurrence) {
    const every = event.recurrence === 'weekdays' ? 'Weekdays' : 'Every day';
    return event.allDay ? every : `${every} · ${span}`;
  }
  if (event.allDay) return `${formatDayLabel(start)} · all day`;
  return `${formatDayLabel(start)} · ${span}`;
}

/** World event detail, openable from any view. */
export default function EventSheet({
  eventId,
  onClose,
}: {
  eventId: string | null;
  onClose: () => void;
}) {
  const state = useDaytimeState();
  const store = useStore();
  const now = useNow();

  const event = state.events.find((e) => e.id === eventId);
  if (!event) return null;

  const domain = domainById(state, event.domainId);
  const linked = tasksForEvent(state, event.id);

  return (
    <Sheet
      open
      onClose={onClose}
      title={event.title}
      subtitle={when(event)}
      accent={domain?.accent}
    >
      {event.location && (
        <p className="meta-line">
          <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden>
            <path
              d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z M12 10.5a1.8 1.8 0 100-3.6 1.8 1.8 0 000 3.6z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
          {event.location}
        </p>
      )}

      {domain && (
        <p className="meta-line" style={{ color: domain.accent }}>
          {domain.name}
        </p>
      )}

      <div className="quick-add">
        <select
          className="field field--select"
          aria-label="Spoke"
          value={event.domainId ?? ''}
          onChange={(e) => {
            const next = e.target.value;
            store.updateEvent(event.id, next ? { domainId: next } : { domainId: undefined });
          }}
        >
          <option value="">No spoke</option>
          {state.domains.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="pill"
          style={
            event.priority
              ? ({ '--pill': PRIORITY_COLOR[event.priority] } as React.CSSProperties)
              : undefined
          }
          title="Cycle priority"
          onClick={() =>
            store.updateEvent(event.id, {
              priority: event.priority ? NEXT_PRIORITY[event.priority] : 2,
            })
          }
        >
          {event.priority ? PRIORITY_LABEL[event.priority] : 'No priority'}
        </button>
      </div>

      {linked.length > 0 && (
        <section className="block">
          <h3 className="block__title">Tasks attached</h3>
          <div className="list">
            {linked.map((task) => (
              <TaskRow key={task.id} task={task} now={now} showDomain />
            ))}
          </div>
        </section>
      )}

      <div className="row-actions">
        <button
          type="button"
          className="btn btn--danger"
          onClick={() => {
            store.removeEvent(event.id);
            onClose();
          }}
        >
          Delete event
        </button>
      </div>
    </Sheet>
  );
}
