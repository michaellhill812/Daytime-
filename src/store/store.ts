import type { CalEvent, DaytimeState, Doc, Domain, Goal, Message, Priority, Task } from '../types';
import type { PeopleDirectory } from './selectors';
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

  /**
   * Who is making these changes — the signed-in email, or null when nobody is
   * signed in. Not part of the shared document: it describes this session, not
   * the workspace, and writing it into state would send it to everyone.
   */
  actor: string | null = null;

  /**
   * Email to display name for everyone in this workspace, filled in at boot.
   * Not part of the document: it belongs to the accounts, not to the data, and
   * writing it into shared state would mean one person renaming themselves
   * edited everyone else's copy.
   */
  people: PeopleDirectory = {};

  constructor(
    initial: DaytimeState,
    readonly adapter: StorageAdapter,
    private readonly saveDelayMs = 250,
  ) {
    this.state = initial;
  }

  /** Fields stamped on anything newly created, so the Wall can say who added it. */
  private authorship(): { createdAt: string; createdBy?: string } {
    return {
      createdAt: new Date().toISOString(),
      ...(this.actor ? { createdBy: this.actor } : {}),
    };
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
    /** Wall documents to attach at creation, so a reference need not be added twice. */
    docIds?: string[];
  }): Task => {
    const task: Task = {
      id: uid('task'),
      domainId: input.domainId,
      title: input.title.trim(),
      priority: input.priority ?? 2,
      done: false,
      docIds: input.docIds ? [...input.docIds] : [],
      eventIds: [],
      ...this.authorship(),
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

  addDoc = (input: {
    title: string;
    domainId?: string;
    body?: string;
    kind?: Doc['kind'];
  }): Doc => {
    const doc: Doc = {
      id: uid('doc'),
      title: input.title.trim(),
      kind: input.kind ?? 'note',
      pinned: false,
      updatedAt: new Date().toISOString(),
      ...this.authorship(),
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
    priority?: Priority;
  }): CalEvent => {
    const event: CalEvent = {
      id: uid('ev'),
      title: input.title.trim(),
      start: input.start,
      allDay: input.allDay ?? false,
      ...this.authorship(),
      ...(input.end ? { end: input.end } : {}),
      ...(input.domainId ? { domainId: input.domainId } : {}),
      ...(input.location ? { location: input.location } : {}),
      ...(input.priority ? { priority: input.priority } : {}),
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

  // ------------------------------------------------------------- messages --

  /** `to` empty means everyone. Sending is a no-op without a signed-in actor. */
  sendMessage = (body: string, to: string[]): Message | null => {
    const text = body.trim();
    if (!text || !this.actor) return null;

    const message: Message = {
      id: uid('msg'),
      body: text,
      from: this.actor,
      // Never address yourself: a message you sent is already read by you, and
      // counting it would leave the badge permanently lit.
      to: to.filter((email) => email.toLowerCase() !== this.actor?.toLowerCase()),
      at: new Date().toISOString(),
      readBy: [this.actor],
    };
    this.commit({ ...this.state, messages: [...(this.state.messages ?? []), message] });
    return message;
  };

  /**
   * Mark everything currently addressed to this person as read. Stored on the
   * message rather than on the device, so reading on a phone clears the badge
   * on a laptop too.
   */
  markMessagesRead = (ids: string[]): void => {
    const me = this.actor;
    if (!me || ids.length === 0) return;

    const wanted = new Set(ids);
    this.commit({
      ...this.state,
      messages: (this.state.messages ?? []).map((m) =>
        wanted.has(m.id) && !m.readBy.includes(me) ? { ...m, readBy: [...m.readBy, me] } : m,
      ),
    });
  };

  removeMessage = (id: string): void => {
    this.commit({
      ...this.state,
      messages: (this.state.messages ?? []).filter((m) => m.id !== id),
    });
  };

  // ------------------------------------------------------------- daynotes --

  setDayNote = (date: string, body: string): void => {
    const existing = this.state.dayNotes.find((n) => n.date === date);
    const trimmed = body.trim();

    let dayNotes;
    if (!existing)
      dayNotes = trimmed ? [...this.state.dayNotes, { date, body }] : this.state.dayNotes;
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

  /**
   * Take a document that came from somewhere else (another device, another
   * person). Notifies the UI but does not schedule a save — the server already
   * has this revision, and writing it back would start a ping-pong.
   */
  adoptRemote = (next: DaytimeState): void => {
    this.state = next;
    for (const l of this.listeners) l();
  };

  /** Wire up an adapter's live channel, if it has one. */
  connect = (): (() => void) => {
    if (!this.adapter.subscribe) return () => {};
    return this.adapter.subscribe(this.adoptRemote);
  };
}

/** Convenience: today's date key, for day-note reads/writes. */
export const todayKey = (): string => toDateKey(new Date());
