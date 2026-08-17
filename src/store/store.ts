import type { CalEvent, DaytimeState, Doc, Domain, Goal, Priority, Task } from '../types';
import type { StorageAdapter } from './storage';
import { uid } from '../lib/id';
import { toDateKey } from '../lib/date';

type Listener = () => void;

/**
 * A tiny observable state container. State is replaced wholesale on every
 * action, so the object identity of `getState()` doubles as a change token for
 * `useSyncExternalStore`. Writes are persisted through the adapter on a short
 * debounce — typing in a note shouldn't hit storage on every keystroke.
 */
export class DaytimeStore {
  private state: DaytimeState;
  private listeners = new Set<Listener>();
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    initial: DaytimeState,
    private readonly adapter: StorageAdapter,
    private readonly saveDelayMs = 250,
  ) {
    this.state = initial;
  }

  getState = (): DaytimeState => this.state;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private commit(next: DaytimeState): void {
    this.state = next;
    for (const l of this.listeners) l();
    this.schedulePersist();
  }

  private schedulePersist(): void {
    if (this.saveTimer !== null) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      void this.adapter.save(this.state);
    }, this.saveDelayMs);
  }

  /** Flush any pending write immediately (used when the tab is being hidden). */
  flush = (): void => {
    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    void this.adapter.save(this.state);
  };

  // ---------------------------------------------------------------- tasks --

  addTask = (input: {
    domainId: string;
    title: string;
    priority?: Priority;
    due?: string;
    notes?: string;
  }): Task => {
    const task: Task = {
      id: uid('task'),
      domainId: input.domainId,
      title: input.title.trim(),
      priority: input.priority ?? 2,
      done: false,
      docIds: [],
      eventIds: [],
      ...(input.due ? { due: input.due } : {}),
      ...(input.notes ? { notes: input.notes } : {}),
    };
    this.commit({ ...this.state, tasks: [...this.state.tasks, task] });
    return task;
  };

  updateTask = (id: string, patch: Partial<Omit<Task, 'id'>>): void => {
    this.commit({
      ...this.state,
      tasks: this.state.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    });
  };

  toggleTask = (id: string): void => {
    this.commit({
      ...this.state,
      tasks: this.state.tasks.map((t) => {
        if (t.id !== id) return t;
        const done = !t.done;
        const next: Task = { ...t, done };
        if (done) next.completedAt = new Date().toISOString();
        else delete next.completedAt;
        return next;
      }),
    });
  };

  removeTask = (id: string): void => {
    this.commit({ ...this.state, tasks: this.state.tasks.filter((t) => t.id !== id) });
  };

  /** Attach or detach a Wall document from a task. */
  toggleTaskDoc = (taskId: string, docId: string): void => {
    this.commit({
      ...this.state,
      tasks: this.state.tasks.map((t) =>
        t.id === taskId
          ? {
              ...t,
              docIds: t.docIds.includes(docId)
                ? t.docIds.filter((d) => d !== docId)
                : [...t.docIds, docId],
            }
          : t,
      ),
    });
  };

  /** Attach or detach a World event from a task. */
  toggleTaskEvent = (taskId: string, eventId: string): void => {
    this.commit({
      ...this.state,
      tasks: this.state.tasks.map((t) =>
        t.id === taskId
          ? {
              ...t,
              eventIds: t.eventIds.includes(eventId)
                ? t.eventIds.filter((e) => e !== eventId)
                : [...t.eventIds, eventId],
            }
          : t,
      ),
    });
  };

  // ----------------------------------------------------------------- docs --

  addDoc = (input: { title: string; domainId?: string; body?: string; kind?: Doc['kind'] }): Doc => {
    const doc: Doc = {
      id: uid('doc'),
      title: input.title.trim(),
      kind: input.kind ?? 'note',
      pinned: false,
      updatedAt: new Date().toISOString(),
      ...(input.domainId ? { domainId: input.domainId } : {}),
      ...(input.body ? { body: input.body } : {}),
    };
    this.commit({ ...this.state, docs: [...this.state.docs, doc] });
    return doc;
  };

  updateDoc = (id: string, patch: Partial<Omit<Doc, 'id'>>): void => {
    this.commit({
      ...this.state,
      docs: this.state.docs.map((d) =>
        d.id === id ? { ...d, ...patch, updatedAt: new Date().toISOString() } : d,
      ),
    });
  };

  toggleDocPin = (id: string): void => {
    this.commit({
      ...this.state,
      docs: this.state.docs.map((d) => (d.id === id ? { ...d, pinned: !d.pinned } : d)),
    });
  };

  removeDoc = (id: string): void => {
    this.commit({
      ...this.state,
      docs: this.state.docs.filter((d) => d.id !== id),
      // Keep task links honest rather than leaving dangling ids behind.
      tasks: this.state.tasks.map((t) =>
        t.docIds.includes(id) ? { ...t, docIds: t.docIds.filter((x) => x !== id) } : t,
      ),
    });
  };

  // --------------------------------------------------------------- events --

  addEvent = (input: {
    title: string;
    start: string;
    end?: string;
    allDay?: boolean;
    domainId?: string;
    location?: string;
  }): CalEvent => {
    const event: CalEvent = {
      id: uid('ev'),
      title: input.title.trim(),
      start: input.start,
      allDay: input.allDay ?? false,
      ...(input.end ? { end: input.end } : {}),
      ...(input.domainId ? { domainId: input.domainId } : {}),
      ...(input.location ? { location: input.location } : {}),
    };
    this.commit({ ...this.state, events: [...this.state.events, event] });
    return event;
  };

  updateEvent = (id: string, patch: Partial<Omit<CalEvent, 'id'>>): void => {
    this.commit({
      ...this.state,
      events: this.state.events.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    });
  };

  removeEvent = (id: string): void => {
    this.commit({
      ...this.state,
      events: this.state.events.filter((e) => e.id !== id),
      tasks: this.state.tasks.map((t) =>
        t.eventIds.includes(id) ? { ...t, eventIds: t.eventIds.filter((x) => x !== id) } : t,
      ),
    });
  };

  // ------------------------------------------------------------- daynotes --

  setDayNote = (date: string, body: string): void => {
    const existing = this.state.dayNotes.find((n) => n.date === date);
    const trimmed = body.trim();

    let dayNotes;
    if (!existing) dayNotes = trimmed ? [...this.state.dayNotes, { date, body }] : this.state.dayNotes;
    else if (!trimmed) dayNotes = this.state.dayNotes.filter((n) => n.date !== date);
    else dayNotes = this.state.dayNotes.map((n) => (n.date === date ? { ...n, body } : n));

    this.commit({ ...this.state, dayNotes });
  };

  // -------------------------------------------------------------- domains --

  addDomain = (name: string, accent: string): Domain => {
    const domain: Domain = {
      id: uid('dom'),
      name: name.trim(),
      accent,
      order: this.state.domains.length,
    };
    this.commit({ ...this.state, domains: [...this.state.domains, domain] });
    return domain;
  };

  updateDomain = (id: string, patch: Partial<Omit<Domain, 'id'>>): void => {
    this.commit({
      ...this.state,
      domains: this.state.domains.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    });
  };

  /** Removes the domain and everything filed under it. */
  removeDomain = (id: string): void => {
    const domains = this.state.domains
      .filter((d) => d.id !== id)
      .map((d, i) => ({ ...d, order: i }));

    this.commit({
      ...this.state,
      domains,
      tasks: this.state.tasks.filter((t) => t.domainId !== id),
      goals: this.state.goals.filter((g) => g.domainId !== id),
      docs: this.state.docs.map((d) => (d.domainId === id ? { ...d, domainId: undefined } : d)),
      events: this.state.events.map((e) => (e.domainId === id ? { ...e, domainId: undefined } : e)),
    });
  };

  // ---------------------------------------------------------------- goals --

  addGoal = (input: { domainId: string; title: string; horizon: Goal['horizon'] }): Goal => {
    const goal: Goal = {
      id: uid('goal'),
      domainId: input.domainId,
      title: input.title.trim(),
      horizon: input.horizon,
      progress: 0,
    };
    this.commit({ ...this.state, goals: [...this.state.goals, goal] });
    return goal;
  };

  updateGoal = (id: string, patch: Partial<Omit<Goal, 'id'>>): void => {
    this.commit({
      ...this.state,
      goals: this.state.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)),
    });
  };

  removeGoal = (id: string): void => {
    this.commit({ ...this.state, goals: this.state.goals.filter((g) => g.id !== id) });
  };

  // ---------------------------------------------------------------- admin --

  replaceAll = (next: DaytimeState): void => {
    this.commit(next);
  };
}

/** Convenience: today's date key, for day-note reads/writes. */
export const todayKey = (): string => toDateKey(new Date());
