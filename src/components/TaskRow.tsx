import { useDaytimeState, useStore } from '../store/context';
import {
  PRIORITY_COLOR,
  docsForTask,
  domainById,
  eventsForTask,
} from '../store/selectors';
import { dueLabel } from '../lib/date';
import type { Task } from '../types';

interface TaskRowProps {
  task: Task;
  now: Date;
  /** Show which domain the task belongs to — needed in mixed lists, noise in a domain view. */
  showDomain?: boolean;
  onOpenDoc?: (docId: string) => void;
  onOpenEvent?: (eventId: string) => void;
}

/**
 * The single task presentation used by all three views, so a task looks the
 * same wherever you meet it — and carries its links to the Wall and World with it.
 */
export default function TaskRow({
  task,
  now,
  showDomain = false,
  onOpenDoc,
  onOpenEvent,
}: TaskRowProps) {
  const state = useDaytimeState();
  const store = useStore();

  const domain = domainById(state, task.domainId);
  const docs = docsForTask(state, task);
  const events = eventsForTask(state, task);
  const overdue = !task.done && !!task.due && new Date(task.due).getTime() < now.getTime();

  return (
    <div className={`task${task.done ? ' task--done' : ''}`}>
      <button
        type="button"
        className="task__check"
        style={{ '--tick': PRIORITY_COLOR[task.priority] } as React.CSSProperties}
        aria-pressed={task.done}
        aria-label={task.done ? `Mark "${task.title}" not done` : `Mark "${task.title}" done`}
        onClick={() => store.toggleTask(task.id)}
      >
        {task.done && (
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

      <div className="task__main">
        <p className="task__title">{task.title}</p>

        <div className="task__meta">
          {showDomain && domain && (
            <span className="task__domain" style={{ color: domain.accent }}>
              {domain.name}
            </span>
          )}
          {task.due && (
            <span className={`task__due${overdue ? ' task__due--late' : ''}`}>
              {dueLabel(task.due, now)}
            </span>
          )}
          {!task.due && !task.done && <span className="task__due task__due--none">Someday</span>}

          {docs.map((doc) => (
            <button
              key={doc.id}
              type="button"
              className="chip chip--doc"
              onClick={() => onOpenDoc?.(doc.id)}
              title={`On the Wall: ${doc.title}`}
            >
              <svg viewBox="0 0 24 24" width="11" height="11" aria-hidden>
                <path
                  d="M7 3h7l5 5v13H7z M14 3v5h5"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
              {doc.title}
            </button>
          ))}

          {events.map((ev) => (
            <button
              key={ev.id}
              type="button"
              className="chip chip--event"
              onClick={() => onOpenEvent?.(ev.id)}
              title={`In World: ${ev.title}`}
            >
              <svg viewBox="0 0 24 24" width="11" height="11" aria-hidden>
                <path
                  d="M4 6h16v15H4z M4 10h16 M9 3v4 M15 3v4"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
              {ev.title}
            </button>
          ))}
        </div>

        {task.notes && <p className="task__notes">{task.notes}</p>}
      </div>
    </div>
  );
}
