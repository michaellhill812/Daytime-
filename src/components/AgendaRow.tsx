import { usePeek } from './PeekProvider';
import { useDaytimeState, useStore } from '../store/context';
import { PRIORITY_COLOR, creditFor, domainById, type AgendaItem } from '../store/selectors';
import { formatTime } from '../lib/date';

/**
 * One line of a day, whether it came from the calendar or the Wheel.
 *
 * Both render the same because on the day itself they are the same: a thing,
 * at a time, belonging to a spoke. What differs is only what you can do with
 * it — a task can be ticked off, an event can't, so the checkbox is the one
 * asymmetry rather than a whole separate list.
 */
export default function AgendaRow({ item }: { item: AgendaItem }) {
  const state = useDaytimeState();
  const store = useStore();
  const { openEvent, openTask } = usePeek();

  const domain = domainById(state, item.domainId);
  const accent = domain?.accent ?? 'rgba(255,255,255,0.3)';
  const isTask = item.kind === 'task';
  const credit = creditFor(item.task ?? item.event ?? {}, store.actor);

  const when = item.at
    ? item.end
      ? `${formatTime(item.at)}–${formatTime(item.end)}`
      : formatTime(item.at)
    : isTask
      ? 'to-do'
      : 'all day';

  return (
    <div
      className={`agenda${item.done ? ' agenda--done' : ''}`}
      style={{ '--row-accent': accent } as React.CSSProperties}
    >
      <span className="agenda__when">{when}</span>

      {isTask ? (
        <button
          type="button"
          className="task__check agenda__check"
          style={{ '--tick': PRIORITY_COLOR[item.priority ?? 2] } as React.CSSProperties}
          aria-pressed={item.done}
          aria-label={item.done ? `Mark "${item.title}" not done` : `Mark "${item.title}" done`}
          onClick={() => store.toggleTask(item.id)}
        >
          {item.done && (
            <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden>
              <path
                d="M5 12.5l4.5 4.5L19 7"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
          )}
        </button>
      ) : (
        // Keeps events aligned with the tasks around them without pretending
        // to be something you can tick off.
        <span className="agenda__bullet" aria-hidden />
      )}

      <button
        type="button"
        className="agenda__title"
        onClick={() => (isTask ? openTask(item.id) : openEvent(item.id))}
      >
        {item.title}
      </button>

      {item.event?.location && <span className="agenda__where">{item.event.location}</span>}
      {credit && <span className="agenda__where">by {credit}</span>}
      {item.priority && !isTask && (
        <span
          className="event-row__priority"
          style={{ background: PRIORITY_COLOR[item.priority] }}
        />
      )}
    </div>
  );
}
