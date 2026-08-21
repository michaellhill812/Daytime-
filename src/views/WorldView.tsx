import { useEffect, useMemo, useState } from 'react';
import AgendaRow from '../components/AgendaRow';
import { usePeek } from '../components/PeekProvider';
import type { Priority } from '../types';
import { useDaytimeState, useStore } from '../store/context';
import {
  NEXT_PRIORITY,
  PRIORITY_COLOR,
  PRIORITY_LABEL,
  dayAgenda,
  dayNote,
  docCreatedAt,
  docsAddedOn,
  domainById,
  eventsOnDay,
  searchEvents,
  searchTasks,
  tasksOnDay,
  topPriorityOf,
} from '../store/selectors';
import { useNow } from '../hooks/useNow';
import {
  addMonths,
  formatDayLabel,
  formatMonthYear,
  formatShortDay,
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
  const { openDoc } = usePeek();

  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [selected, setSelected] = useState(() => startOfDay(new Date()));
  const [adding, setAdding] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftTime, setDraftTime] = useState('09:00');
  const [draftDomain, setDraftDomain] = useState('');
  const [draftPriority, setDraftPriority] = useState<Priority>(2);
  const [query, setQuery] = useState('');

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
  const { timed, untimed } = useMemo(() => dayAgenda(state, selected), [state, selected]);
  const dayDocs = useMemo(() => docsAddedOn(state, selected), [state, selected]);

  // Events and dated tasks answer the same question — "when is that?" — so
  // both are searched, and an undated task is left out because there is no
  // day to send you to.
  const hits = useMemo(() => {
    if (!query.trim()) return [];
    const events = searchEvents(state, query, now).map((h) => ({
      key: `ev-${h.event.id}`,
      title: h.event.title,
      when: h.when,
      kind: h.event.recurrence ? 'routine' : 'event',
      accent: domainById(state, h.event.domainId)?.accent ?? 'rgba(255,255,255,0.3)',
    }));
    const tasks = searchTasks(state, query)
      .filter((t) => t.due)
      .map((t) => ({
        key: `task-${t.id}`,
        title: t.title,
        when: new Date(t.due!),
        kind: t.done ? 'done' : 'due',
        accent: domainById(state, t.domainId)?.accent ?? 'rgba(255,255,255,0.3)',
      }));
    return [...events, ...tasks].sort((a, b) => a.when.getTime() - b.when.getTime()).slice(0, 25);
  }, [state, query, now]);
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
      priority: draftPriority,
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

      <div className="search search--world">
        <input
          className="field field--search"
          type="search"
          placeholder="Search events and deadlines…"
          value={query}
          aria-label="Search the calendar"
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button
            type="button"
            className="search__clear"
            aria-label="Clear search"
            onClick={() => setQuery('')}
          >
            ×
          </button>
        )}
      </div>

      {/* Results jump the calendar rather than replacing it — the answer to
          "when is that?" is a date, so landing on the day is the whole point. */}
      {query.trim() && (
        <div className="results">
          {hits.length === 0 ? (
            <p className="empty">Nothing matches “{query.trim()}”.</p>
          ) : (
            hits.map((hit) => (
              <button
                key={hit.key}
                type="button"
                className="event-row"
                style={{ '--row-accent': hit.accent } as React.CSSProperties}
                onClick={() => {
                  setAnchor(startOfDay(hit.when));
                  setSelected(startOfDay(hit.when));
                  setQuery('');
                }}
              >
                <span className="event-row__when">{formatShortDay(hit.when)}</span>
                <span className="event-row__title">{hit.title}</span>
                <span className="event-row__where">{hit.kind}</span>
              </button>
            ))
          )}
        </div>
      )}

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
          // Dots mark what makes a day different, so the daily routine is left
          // out — repeated on all of them, it distinguishes none of them.
          const events = eventsOnDay(state, day).filter((e) => !e.recurrence);
          const dueTasks = tasksOnDay(state, day);
          const openDue = dueTasks.filter((t) => !t.done);
          const wallAdds = docsAddedOn(state, day).length;

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
                {/* A hollow mark, so a day that only gained a document reads as
                    a record of something rather than a demand for something. */}
                {wallAdds > 0 && <span className="day__wall" aria-hidden />}
                {/* The badge was always red, which said "urgent" about a day
                    holding nothing but low-priority work. It takes the hottest
                    priority due that day instead — the same rule the wheel's
                    arc uses, so a colour means one thing across both views. */}
                {openDue.length > 0 && (
                  <span
                    className="day__due"
                    style={
                      {
                        '--due': PRIORITY_COLOR[topPriorityOf(openDue) ?? 3],
                      } as React.CSSProperties
                    }
                  >
                    {openDue.length}
                  </span>
                )}
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
              className="pill"
              style={{ '--pill': PRIORITY_COLOR[draftPriority] } as React.CSSProperties}
              onClick={() => setDraftPriority(NEXT_PRIORITY[draftPriority])}
              title="Cycle priority"
            >
              {PRIORITY_LABEL[draftPriority]}
            </button>
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

        {timed.length === 0 && untimed.length === 0 && dayDocs.length === 0 && !note && (
          <p className="empty">Nothing on this day.</p>
        )}

        {/* One schedule, not two lists: a 2pm deadline set on the Wheel and a
            2pm block put on the calendar are the same fact about the day, and
            reading them apart means reading the day twice. */}
        {timed.length > 0 && (
          <section className="block">
            <h3 className="block__title">Schedule</h3>
            <div className="list">
              {timed.map((item) => (
                <AgendaRow key={`${item.kind}-${item.id}`} item={item} />
              ))}
            </div>
          </section>
        )}

        {untimed.length > 0 && (
          <section className="block">
            <h3 className="block__title">Also today</h3>
            <div className="list">
              {untimed.map((item) => (
                <AgendaRow key={`${item.kind}-${item.id}`} item={item} />
              ))}
            </div>
          </section>
        )}

        {dayDocs.length > 0 && (
          <section className="block">
            <h3 className="block__title">Added to the Wall</h3>
            <div className="list">
              {dayDocs.map((doc) => {
                const domain = domainById(state, doc.domainId);
                return (
                  <button
                    key={doc.id}
                    type="button"
                    className="event-row"
                    onClick={() => openDoc(doc.id)}
                    style={
                      {
                        '--row-accent': domain?.accent ?? 'rgba(255,255,255,0.3)',
                      } as React.CSSProperties
                    }
                  >
                    <span className="event-row__when">
                      {formatTime(new Date(docCreatedAt(doc)))}
                    </span>
                    <span className="event-row__title">{doc.title}</span>
                    {domain && (
                      <span className="event-row__where" style={{ color: domain.accent }}>
                        {domain.name}
                      </span>
                    )}
                  </button>
                );
              })}
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
