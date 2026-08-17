import Sheet from './Sheet';
import TaskRow from './TaskRow';
import { useDaytimeState, useStore } from '../store/context';
import { domainById, tasksForEvent } from '../store/selectors';
import { useNow } from '../hooks/useNow';
import { formatDayLabel, formatTime } from '../lib/date';

function when(startISO: string, endISO: string | undefined, allDay: boolean): string {
  const start = new Date(startISO);
  if (allDay) return `${formatDayLabel(start)} · all day`;
  const head = `${formatDayLabel(start)} · ${formatTime(start)}`;
  return endISO ? `${head}–${formatTime(new Date(endISO))}` : head;
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
      subtitle={when(event.start, event.end, event.allDay)}
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
