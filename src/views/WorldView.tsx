import { useEffect, useMemo, useState } from 'react';
import TaskRow from '../components/TaskRow';
import { usePeek } from '../components/PeekProvider';
import { useDaytimeState, useStore } from '../store/context';
import { dayNote, domainById, eventsOnDay, tasksOnDay } from '../store/selectors';
import { useNow } from '../hooks/useNow';
import {
  addMonths,
  formatDayLabel,
  formatMonthYear,
  formatTime,
  isSameDay,
  monthGrid,
  startOfDay,
  toDateKey,
} from '../lib/date';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/**
 * The calendar. It shows its own events plus every deadline set on the Wheel,
 * so a task with a date exists in both places without being entered twice.
 */
export default function WorldView({ open, onClose }: { open: boolean; onClose: () => void }) {
  const state = useDaytimeState();
  const store = useStore();
  const now = useNow();
  const { openEvent } = usePeek();

  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [selected, setSelected] = useState(() => startOfDay(new Date()));
  const [adding, setAdding] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftTime, setDraftTime] = useState('09:00');
  const [draftDomain, setDraftDomain] = useState('');

  // Coming back to World should feel like arriving at now, not where you left off.
  useEffect(() => {
    if (open) {
      const today = startOfDay(new Date());
      setAnchor(today);
      setSelected(today);
      setAdding(false);
    }
  }, [open]);

  const grid = useMemo(() => monthGrid(anchor), [anchor]);
  const dayEvents = useMemo(() => eventsOnDay(state, selected), [state, selected]);
  const dayTasks = useMemo(() => tasksOnDay(state, selected), [state, selected]);
  const note = dayNote(state, selected);

  const submitEvent = () => {
    const title = draftTitle.trim();
    if (!title) return;

    const [h, m] = draftTime.split(':').map(Number);
    const start = startOfDay(selected);
    start.setHours(h ?? 9, m ?? 0, 0, 0);

    store.addEvent({
      title,
      start: start.toISOString(),
      ...(draftDomain ? { domainId: draftDomain } : {}),
    });
    setDraftTitle('');
    setAdding(false);
  };

  return (
    <div className={`view view--world${open ? ' is-open' : ''}`} aria-hidden={!open}>
      <div className="world__grip" aria-hidden />

      <header className="world__head">
        <button
          type="button"
          className="icon-btn"
          aria-label="Previous month"
          onClick={() => setAnchor((a) => addMonths(a, -1))}
        >
          ‹
        </button>
        <h1 className="world__month">{formatMonthYear(anchor)}</h1>
        <button
          type="button"
          className="icon-btn"
          aria-label="Next month"
          onClick={() => setAnchor((a) => addMonths(a, 1))}
        >
          ›
        </button>
        <button type="button" className="btn btn--ghost" onClick={onClose}>
          Close
        </button>
      </header>

      <div className="world__weekdays" aria-hidden>
        {WEEKDAYS.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>

      <div className="world__grid" role="grid" aria-label={formatMonthYear(anchor)}>
        {grid.map((day) => {
          const inMonth = day.getMonth() === anchor.getMonth();
          const isToday = isSameDay(day, now);
          const isSelected = isSameDay(day, selected);
          const events = eventsOnDay(state, day);
          const dueTasks = tasksOnDay(state, day);
          const openDue = dueTasks.filter((t) => !t.done);

          return (
            <button
              key={toDateKey(day)}
              type="button"
              role="gridcell"
              aria-selected={isSelected}
              className={[
                'day',
                inMonth ? '' : 'day--muted',
                isToday ? 'day--today' : '',
                isSelected ? 'day--selected' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => setSelected(day)}
            >
              <span className="day__num">{day.getDate()}</span>
              <span className="day__marks">
                {events.slice(0, 3).map((e) => (
                  <span
                    key={e.id}
                    className="day__dot"
                    style={{
                      background: domainById(state, e.domainId)?.accent ?? 'rgba(255,255,255,0.5)',
                    }}
                  />
                ))}
                {openDue.length > 0 && <span className="day__due">{openDue.length}</span>}
              </span>
            </button>
          );
        })}
      </div>

      <div className="world__day">
        <div className="world__day-head">
          <h2 className="world__day-title">{formatDayLabel(selected)}</h2>
          <button type="button" className="btn" onClick={() => setAdding((v) => !v)}>
            {adding ? 'Cancel' : '+ Event'}
          </button>
        </div>

        {adding && (
          <div className="quick-add">
            <input
              className="field"
              autoFocus
              placeholder="What's happening?"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitEvent();
              }}
            />
            <input
              className="field field--time"
              type="time"
              value={draftTime}
              onChange={(e) => setDraftTime(e.target.value)}
            />
            <select
              className="field field--select"
              value={draftDomain}
              onChange={(e) => setDraftDomain(e.target.value)}
            >
              <option value="">No domain</option>
              {state.domains.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn--primary"
              onClick={submitEvent}
              disabled={!draftTitle.trim()}
            >
              Add
            </button>
          </div>
        )}

        {dayEvents.length === 0 && dayTasks.length === 0 && !note && (
          <p className="empty">Nothing on this day.</p>
        )}

        {dayEvents.length > 0 && (
          <section className="block">
            <h3 className="block__title">Events</h3>
            <div className="list">
              {dayEvents.map((ev) => {
                const domain = domainById(state, ev.domainId);
                return (
                  <button
                    key={ev.id}
                    type="button"
                    className="event-row"
                    onClick={() => openEvent(ev.id)}
                    style={
                      { '--row-accent': domain?.accent ?? 'rgba(255,255,255,0.3)' } as React.CSSProperties
                    }
                  >
                    <span className="event-row__when">
                      {ev.allDay ? 'all day' : formatTime(new Date(ev.start))}
                    </span>
                    <span className="event-row__title">{ev.title}</span>
                    {ev.location && <span className="event-row__where">{ev.location}</span>}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {dayTasks.length > 0 && (
          <section className="block">
            <h3 className="block__title">Due</h3>
            <div className="list">
              {dayTasks.map((task) => (
                <TaskRow key={task.id} task={task} now={now} showDomain />
              ))}
            </div>
          </section>
        )}

        <section className="block">
          <h3 className="block__title">What happened</h3>
          <textarea
            className="field field--body"
            rows={3}
            placeholder="A line about the day…"
            value={note}
            onChange={(e) => store.setDayNote(toDateKey(selected), e.target.value)}
          />
        </section>
      </div>
    </div>
  );
}
