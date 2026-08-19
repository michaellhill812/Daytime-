import Sheet from './Sheet';
import { useDaytimeState, useStore } from '../store/context';
import {
  NEXT_PRIORITY,
  PRIORITY_COLOR,
  PRIORITY_LABEL,
  docsForTask,
  domainById,
  eventsForTask,
} from '../store/selectors';
import { fromDateTimeInputs, toDateKey, toTimeInput } from '../lib/date';

/**
 * Task detail, openable from anywhere a task appears.
 *
 * Everything a task carries was settable only at the moment it was created —
 * so a typo in a title, or a deadline that moved, meant deleting it and typing
 * it again. Each control here writes straight through to the store; there is
 * no draft state and no Save button, because a half-finished edit that gets
 * lost on close is worse than one that lands immediately.
 */
export default function TaskSheet({
  taskId,
  onClose,
}: {
  taskId: string | null;
  onClose: () => void;
}) {
  const state = useDaytimeState();
  const store = useStore();

  const task = state.tasks.find((t) => t.id === taskId);
  if (!task) return null;

  const domain = domainById(state, task.domainId);
  const docs = docsForTask(state, task);
  const events = eventsForTask(state, task);

  const dueDate = task.due ? toDateKey(new Date(task.due)) : '';
  const dueTime = task.due ? toTimeInput(task.due) : '';

  const setDue = (date: string, time: string) => {
    const due = fromDateTimeInputs(date, time);
    store.updateTask(task.id, due ? { due } : { due: undefined });
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={task.title}
      subtitle={domain?.name}
      {...(domain?.accent ? { accent: domain.accent } : {})}
    >
      <div className="compose">
        <label className="compose__label" htmlFor="task-title">
          Title
        </label>
        <input
          id="task-title"
          className="field"
          value={task.title}
          placeholder="What needs doing?"
          onChange={(e) => store.updateTask(task.id, { title: e.target.value })}
        />

        <label className="compose__label" htmlFor="task-domain">
          Spoke
        </label>
        <select
          id="task-domain"
          className="field field--select"
          value={task.domainId}
          onChange={(e) => store.updateTask(task.id, { domainId: e.target.value })}
        >
          {state.domains.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        <label className="compose__label">Priority</label>
        <div className="row-actions row-actions--start">
          <button
            type="button"
            className="pill"
            style={{ '--pill': PRIORITY_COLOR[task.priority] } as React.CSSProperties}
            onClick={() => store.updateTask(task.id, { priority: NEXT_PRIORITY[task.priority] })}
            title="Cycle priority"
          >
            {PRIORITY_LABEL[task.priority]}
          </button>
        </div>

        <label className="compose__label" htmlFor="task-date">
          Due
        </label>
        <div className="compose__row">
          <input
            id="task-date"
            className="field field--date"
            type="date"
            value={dueDate}
            aria-label="Due date"
            onChange={(e) => setDue(e.target.value, dueTime)}
          />
          <input
            className="field field--time"
            type="time"
            value={dueTime}
            aria-label="Due time"
            disabled={!dueDate}
            onChange={(e) => setDue(dueDate, e.target.value)}
          />
          {task.due && (
            <button
              type="button"
              className="btn"
              onClick={() => store.updateTask(task.id, { due: undefined })}
            >
              Clear
            </button>
          )}
        </div>

        <label className="compose__label" htmlFor="task-notes">
          Notes
        </label>
        <textarea
          id="task-notes"
          className="field field--body"
          rows={3}
          value={task.notes ?? ''}
          placeholder="Anything worth remembering…"
          onChange={(e) => store.updateTask(task.id, { notes: e.target.value })}
        />
      </div>

      {(docs.length > 0 || events.length > 0) && (
        <section className="block">
          <h3 className="block__title">Linked</h3>
          <div className="chips">
            {docs.map((doc) => (
              <span key={doc.id} className="chip">
                {doc.title}
              </span>
            ))}
            {events.map((ev) => (
              <span key={ev.id} className="chip">
                {ev.title}
              </span>
            ))}
          </div>
        </section>
      )}

      <div className="row-actions">
        <button type="button" className="btn" onClick={() => store.toggleTask(task.id)}>
          {task.done ? 'Mark not done' : 'Mark done'}
        </button>
        <button
          type="button"
          className="btn btn--danger"
          onClick={() => {
            store.removeTask(task.id);
            onClose();
          }}
        >
          Delete
        </button>
      </div>
    </Sheet>
  );
}
