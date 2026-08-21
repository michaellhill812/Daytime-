import { useMemo, useState } from 'react';
import Sheet from './Sheet';
import { useDaytimeState, useStore } from '../store/context';
import {
  NEXT_PRIORITY,
  PRIORITY_COLOR,
  PRIORITY_LABEL,
  domainById,
  eventsForTask,
  docsForPicking,
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

  const task = state.tasks.find((t) => t.id === taskId) ?? null;

  // Every hook runs before the missing-task guard below. React matches hooks
  // by call order, so returning early above one would break the next render
  // that does find a task.
  const [docQuery, setDocQuery] = useState('');

  const pickable = useMemo(
    () =>
      task
        ? docsForPicking(state, {
            domainId: task.domainId,
            attached: task.docIds,
            query: docQuery,
          })
        : [],
    [state, docQuery, task],
  );

  if (!task) return null;

  const domain = domainById(state, task.domainId);
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

      {/* Attaching lives here rather than on the Wall because a document
          belongs to many tasks but a task is what you are actually working on
          — you reach for the reference from the job, not the other way round.
          Toggling writes straight through, so there is nothing to save. */}
      <section className="block">
        <h3 className="block__title">
          From the Wall
          {task.docIds.length > 0 && <span className="block__count">{task.docIds.length}</span>}
        </h3>

        {state.docs.length > 8 && (
          <input
            className="field field--search"
            type="search"
            value={docQuery}
            placeholder="Filter documents…"
            aria-label="Filter documents"
            onChange={(e) => setDocQuery(e.target.value)}
            style={{ marginBottom: 10 }}
          />
        )}

        {pickable.length === 0 ? (
          <p className="empty">Nothing on the Wall matches.</p>
        ) : (
          <div className="chips">
            {pickable.map((doc) => {
              const linked = task.docIds.includes(doc.id);
              return (
                <button
                  key={doc.id}
                  type="button"
                  className={`chip chip--pick${linked ? ' is-on' : ''}`}
                  aria-pressed={linked}
                  onClick={() => store.toggleTaskDoc(task.id, doc.id)}
                >
                  {linked && <span aria-hidden>✓ </span>}
                  {doc.title}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {events.length > 0 && (
        <section className="block">
          <h3 className="block__title">In World</h3>
          <div className="chips">
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
