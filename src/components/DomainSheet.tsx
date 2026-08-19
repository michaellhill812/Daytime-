import { useMemo, useState } from 'react';
import Sheet from './Sheet';
import Diagram from './Diagram';
import TaskRow from './TaskRow';
import { usePeek } from './PeekProvider';
import { useDaytimeState, useStore } from '../store/context';
import { NEXT_PRIORITY, PRIORITY_COLOR, PRIORITY_LABEL, domainSnapshot } from '../store/selectors';
import { formatShortDay, formatTime, toDateKey } from '../lib/date';
import type { Goal, Priority } from '../types';

interface DomainSheetProps {
  domainId: string | null;
  onClose: () => void;
  now: Date;
}

function GoalLine({ goal }: { goal: Goal }) {
  return (
    <div className="goal">
      <div className="goal__head">
        <span className="goal__title">{goal.title}</span>
        <span className="goal__pct">{Math.round(goal.progress * 100)}%</span>
      </div>
      <div className="goal__track">
        <div className="goal__fill" style={{ width: `${goal.progress * 100}%` }} />
      </div>
    </div>
  );
}

/**
 * A domain's full picture: goals on both horizons, its tasks, and the Wall and
 * World items connected to it — the things the hub's summary deliberately
 * leaves out.
 */
export default function DomainSheet({ domainId, onClose, now }: DomainSheetProps) {
  const state = useDaytimeState();
  const store = useStore();
  const { openDoc, openEvent } = usePeek();

  const [draft, setDraft] = useState('');
  const [priority, setPriority] = useState<Priority>(2);
  // An empty date is "someday". A date with no time is a deadline on that day
  // rather than at a moment in it, so it lands at end of day.
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [showDone, setShowDone] = useState(false);

  const snap = useMemo(
    () => (domainId ? domainSnapshot(state, domainId, now) : null),
    [state, domainId, now],
  );

  if (!snap) return null;

  const submit = () => {
    const title = draft.trim();
    if (!title) return;

    let due: string | undefined;
    if (dueDate) {
      // Built from parts rather than parsed from a string: `new Date('2026-03-04')`
      // is UTC midnight, which is the previous day for anyone west of Greenwich.
      const [y, mo, d] = dueDate.split('-').map(Number);
      const [h, mi] = dueTime ? dueTime.split(':').map(Number) : [23, 59];
      const at = new Date(y ?? 1970, (mo ?? 1) - 1, d ?? 1, h ?? 23, mi ?? 59, 0, 0);
      due = at.toISOString();
    }

    store.addTask({ domainId: snap.domain.id, title, priority, ...(due ? { due } : {}) });
    setDraft('');
    setDueDate('');
    setDueTime('');
  };

  const { ring } = snap;

  return (
    <Sheet
      open
      onClose={onClose}
      title={snap.domain.name}
      subtitle={
        ring.total === 0
          ? // A domain whose whole point is its guide isn't "empty"
            snap.guide
            ? undefined
            : 'Nothing filed here yet'
          : `${ring.openCount} open · ${ring.done} of ${ring.total} done${
              ring.overdueCount > 0 ? ` · ${ring.overdueCount} overdue` : ''
            }`
      }
      accent={snap.domain.accent}
    >
      {snap.guide && (
        <section className="guide">
          {snap.guide.diagram && <Diagram name={snap.guide.diagram} />}
          <p className="guide__text">{snap.guide.body}</p>
          <button type="button" className="guide__edit" onClick={() => openDoc(snap.guide!.id)}>
            Open on the Wall to edit
          </button>
        </section>
      )}

      <div className="quick-add">
        <input
          className="field"
          value={draft}
          placeholder={`Add to ${snap.domain.name}…`}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
        />
        <button
          type="button"
          className="pill"
          style={{ '--pill': PRIORITY_COLOR[priority] } as React.CSSProperties}
          onClick={() => setPriority(NEXT_PRIORITY[priority])}
          title="Cycle priority"
        >
          {PRIORITY_LABEL[priority]}
        </button>
        {/* A date puts the task on the calendar; leaving it blank keeps it a
            someday item that still counts on the Wheel. */}
        <input
          className="field field--date"
          type="date"
          value={dueDate}
          aria-label="Due date"
          onChange={(e) => setDueDate(e.target.value)}
        />
        <input
          className="field field--time"
          type="time"
          value={dueTime}
          aria-label="Due time"
          disabled={!dueDate}
          onChange={(e) => setDueTime(e.target.value)}
        />
        <button
          type="button"
          className="pill"
          onClick={() => setDueDate(toDateKey(now))}
          disabled={!!dueDate}
          title="Due today"
        >
          Today
        </button>
        <button
          type="button"
          className="btn btn--primary"
          onClick={submit}
          disabled={!draft.trim()}
        >
          Add
        </button>
      </div>

      {(snap.shortGoals.length > 0 || snap.longGoals.length > 0) && (
        <section className="block">
          <h3 className="block__title">Goals</h3>
          {snap.shortGoals.length > 0 && (
            <>
              <p className="block__hint">Short term</p>
              {snap.shortGoals.map((g) => (
                <GoalLine key={g.id} goal={g} />
              ))}
            </>
          )}
          {snap.longGoals.length > 0 && (
            <>
              <p className="block__hint">Long term</p>
              {snap.longGoals.map((g) => (
                <GoalLine key={g.id} goal={g} />
              ))}
            </>
          )}
        </section>
      )}

      <section className="block">
        <h3 className="block__title">
          Open<span className="block__count">{snap.open.length}</span>
        </h3>
        {snap.open.length === 0 ? (
          <p className="empty">Clear.</p>
        ) : (
          <div className="list">
            {snap.open.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                now={now}
                onOpenDoc={openDoc}
                onOpenEvent={openEvent}
              />
            ))}
          </div>
        )}
      </section>

      {/* The guide is already shown in full above — don't list it again */}
      {snap.docs.filter((d) => d.id !== snap.guide?.id).length > 0 && (
        <section className="block">
          <h3 className="block__title">On the Wall</h3>
          <div className="chips">
            {snap.docs
              .filter((d) => d.id !== snap.guide?.id)
              .map((doc) => (
                <button key={doc.id} type="button" className="chip" onClick={() => openDoc(doc.id)}>
                  {doc.pinned && <span className="chip__pin" aria-hidden />}
                  {doc.title}
                </button>
              ))}
          </div>
        </section>
      )}

      {snap.events.length > 0 && (
        <section className="block">
          <h3 className="block__title">In World</h3>
          <div className="list">
            {snap.events.map((ev) => (
              <button
                key={ev.id}
                type="button"
                className="event-row"
                onClick={() => openEvent(ev.id)}
              >
                <span className="event-row__when">
                  {formatShortDay(new Date(ev.start))}
                  {!ev.allDay && ` · ${formatTime(new Date(ev.start))}`}
                </span>
                <span className="event-row__title">{ev.title}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {snap.done.length > 0 && (
        <section className="block">
          <button type="button" className="disclosure" onClick={() => setShowDone((v) => !v)}>
            {showDone ? 'Hide' : 'Show'} {snap.done.length} done
          </button>
          {showDone && (
            <div className="list">
              {snap.done.map((task) => (
                <TaskRow key={task.id} task={task} now={now} />
              ))}
            </div>
          )}
        </section>
      )}
    </Sheet>
  );
}
