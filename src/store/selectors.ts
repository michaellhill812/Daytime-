import type {
  Authored,
  CalEvent,
  DaytimeState,
  Doc,
  Domain,
  Goal,
  Message,
  Priority,
  Task,
} from '../types';
import { endOfDay, isSameDay, startOfDay, toDateKey } from '../lib/date';

/**
 * Ring / status colors.
 *
 * The ring answers two questions at once: how much a domain is carrying (arc
 * fill) and how hot the hottest of it is (arc hue). Red high, blue low, with
 * amber in the middle so "medium" doesn't have to borrow one of the extremes.
 */
export const PRIORITY_COLOR: Record<Priority, string> = {
  3: '#FF453A',
  2: '#FF9F0A',
  1: '#0A84FF',
};
export const EMPTY_COLOR = '#2A2E38';

export const PRIORITY_LABEL: Record<Priority, string> = {
  3: 'High',
  2: 'Medium',
  1: 'Low',
};

/** The order a priority pill cycles through when tapped. */
export const NEXT_PRIORITY: Record<Priority, Priority> = { 3: 2, 2: 1, 1: 3 };

// ---------------------------------------------------------------- salience --

/**
 * How loudly a deadline is shouting, independent of how much the task matters.
 * Undated tasks sit below "due this week" but above nothing — they still take
 * up room in your head.
 */
export function urgency(task: Task, now: Date): number {
  if (!task.due) return 0.6;

  const due = new Date(task.due).getTime();
  const hoursLeft = (due - now.getTime()) / (1000 * 60 * 60);

  if (hoursLeft <= 0) return 2.0; // overdue
  if (hoursLeft <= 6) return 1.7;
  if (due <= endOfDay(now).getTime()) return 1.5;
  if (hoursLeft <= 72) return 1.1;
  if (hoursLeft <= 168) return 0.85;
  return 0.7;
}

/** Importance × urgency. Used only for ordering, never shown as a number. */
export function salience(task: Task, now: Date): number {
  if (task.done) return 0;
  return task.priority * urgency(task, now);
}

export type FocusBucket = 'overdue' | 'today' | 'deck';

export interface FocusDigest {
  overdue: Task[];
  today: Task[];
  /** High-priority work with no clock on it yet, or landing in the next few days. */
  deck: Task[];
  count: number;
}

/**
 * What the center button stands for: everything with a claim on today, plus the
 * high-priority items that are about to have one.
 */
export function focusDigest(state: DaytimeState, now: Date): FocusDigest {
  const open = state.tasks.filter((t) => !t.done);
  const dayEnd = endOfDay(now).getTime();
  const threeDays = now.getTime() + 3 * 24 * 60 * 60 * 1000;

  const overdue: Task[] = [];
  const today: Task[] = [];
  const deck: Task[] = [];

  for (const t of open) {
    const due = t.due ? new Date(t.due).getTime() : null;

    if (due !== null && due < now.getTime()) overdue.push(t);
    else if (due !== null && due <= dayEnd) today.push(t);
    else if (t.priority === 3 && (due === null || due <= threeDays)) deck.push(t);
  }

  const byUrgency = (a: Task, b: Task) => salience(b, now) - salience(a, now);
  overdue.sort(byUrgency);
  today.sort((a, b) => new Date(a.due!).getTime() - new Date(b.due!).getTime());
  deck.sort(byUrgency);

  return { overdue, today, deck, count: overdue.length + today.length + deck.length };
}

// -------------------------------------------------------------------- ring --

/**
 * Open tasks that fill a domain's whole sector.
 *
 * The arc is an absolute gauge, not a proportion of the domain's own list: a
 * ratio would draw one open task out of one as a full sector and five out of
 * twenty as a quarter, which is backwards for a HUD you read at a glance.
 * Scaling against the busiest domain instead would make every other arc
 * lengthen the moment you cleared the heaviest one — finishing work must never
 * look like acquiring it. A fixed ceiling costs saturation past six and buys a
 * mark that means the same thing every time you look at it.
 */
const FULL_LOAD = 6;

export interface RingSegment {
  domain: Domain;
  total: number;
  done: number;
  /** 0..1 — the share of this domain's arc that is filled by open work. */
  load: number;
  /** Arc hue: the hottest open priority. */
  color: string;
  openCount: number;
  overdueCount: number;
  /** Highest open priority, or null when the domain is clear. */
  topPriority: Priority | null;
}

export function ringSegments(state: DaytimeState, now: Date): RingSegment[] {
  const domains = [...state.domains].sort((a, b) => a.order - b.order);

  return domains.map((domain) => {
    const tasks = state.tasks.filter((t) => t.domainId === domain.id);
    const openTasks = tasks.filter((t) => !t.done);
    const done = tasks.length - openTasks.length;

    const topPriority = openTasks.reduce<Priority | null>(
      (top, t) => (top === null || t.priority > top ? t.priority : top),
      null,
    );

    const overdueCount = openTasks.filter(
      (t) => t.due && new Date(t.due).getTime() < now.getTime(),
    ).length;

    // The arc is only drawn when something is open, so the hue is always a
    // priority in practice. The fallback is here for the type, not the eye.
    const color = topPriority === null ? EMPTY_COLOR : PRIORITY_COLOR[topPriority];

    // A single open task still gets a mark you cannot miss — the whole point of
    // the ring is that nothing open is invisible.
    const load =
      openTasks.length === 0 ? 0 : Math.max(0.2, Math.min(1, openTasks.length / FULL_LOAD));

    return {
      domain,
      total: tasks.length,
      done,
      load,
      color,
      openCount: openTasks.length,
      overdueCount,
      topPriority,
    };
  });
}

// ------------------------------------------------------------ domain views --

export interface DomainSnapshot {
  domain: Domain;
  /** The domain's own reference text, shown before anything else. */
  guide: Doc | null;
  shortGoals: Goal[];
  longGoals: Goal[];
  /** Open tasks, most salient first. */
  open: Task[];
  done: Task[];
  /** Docs filed under this domain, or linked from one of its tasks. */
  docs: Doc[];
  /** Events filed under this domain, or linked from one of its tasks. Upcoming first. */
  events: CalEvent[];
  ring: RingSegment;
}

export function domainSnapshot(
  state: DaytimeState,
  domainId: string,
  now: Date,
): DomainSnapshot | null {
  const domain = state.domains.find((d) => d.id === domainId);
  if (!domain) return null;

  const tasks = state.tasks.filter((t) => t.domainId === domainId);
  const goals = state.goals.filter((g) => g.domainId === domainId);

  const linkedDocIds = new Set(tasks.flatMap((t) => t.docIds));
  const linkedEventIds = new Set(tasks.flatMap((t) => t.eventIds));

  const docs = state.docs
    .filter((d) => d.domainId === domainId || linkedDocIds.has(d.id))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt));

  const events = state.events
    .filter((e) => e.domainId === domainId || linkedEventIds.has(e.id))
    .sort((a, b) => a.start.localeCompare(b.start));

  const ring = ringSegments(state, now).find((r) => r.domain.id === domainId)!;

  return {
    domain,
    guide: state.docs.find((d) => d.id === domain.guideDocId) ?? null,
    shortGoals: goals.filter((g) => g.horizon === 'short'),
    longGoals: goals.filter((g) => g.horizon === 'long'),
    open: tasks.filter((t) => !t.done).sort((a, b) => salience(b, now) - salience(a, now)),
    done: tasks
      .filter((t) => t.done)
      .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '')),
    docs,
    events,
    ring,
  };
}

// -------------------------------------------------------------- back-links --

export function docsForTask(state: DaytimeState, task: Task): Doc[] {
  return task.docIds
    .map((id) => state.docs.find((d) => d.id === id))
    .filter((d): d is Doc => d !== undefined);
}

export function eventsForTask(state: DaytimeState, task: Task): CalEvent[] {
  return task.eventIds
    .map((id) => state.events.find((e) => e.id === id))
    .filter((e): e is CalEvent => e !== undefined);
}

/** Reverse link: which tasks point at this Wall document. */
export function tasksForDoc(state: DaytimeState, docId: string): Task[] {
  return state.tasks.filter((t) => t.docIds.includes(docId));
}

/** Reverse link: which tasks point at this World event. */
export function tasksForEvent(state: DaytimeState, eventId: string): Task[] {
  return state.tasks.filter((t) => t.eventIds.includes(eventId));
}

// --------------------------------------------------------------- calendar --

/** Does a repeating event land on this day? */
function repeatsOn(event: CalEvent, day: Date): boolean {
  if (startOfDay(day) < startOfDay(new Date(event.start))) return false;
  if (event.recurrence === 'daily') return true;
  if (event.recurrence === 'weekdays') {
    const weekday = day.getDay();
    return weekday >= 1 && weekday <= 5;
  }
  return false;
}

/** The same event with its clock times moved onto `day`. */
function occurrenceOn(event: CalEvent, day: Date): CalEvent {
  const from = new Date(event.start);
  const start = startOfDay(day);
  start.setHours(from.getHours(), from.getMinutes(), 0, 0);

  const occurrence: CalEvent = { ...event, start: start.toISOString() };

  if (event.end) {
    const until = new Date(event.end);
    const end = startOfDay(day);
    end.setHours(until.getHours(), until.getMinutes(), 0, 0);
    // A block that ends earlier than it starts runs past midnight.
    if (end <= start) end.setDate(end.getDate() + 1);
    occurrence.end = end.toISOString();
  }

  return occurrence;
}

export function eventsOnDay(state: DaytimeState, day: Date): CalEvent[] {
  const found: CalEvent[] = [];

  for (const event of state.events) {
    if (event.recurrence) {
      if (repeatsOn(event, day)) found.push(occurrenceOn(event, day));
      continue;
    }
    const start = new Date(event.start);
    const end = event.end ? new Date(event.end) : start;
    // Multi-day events show on every day they span.
    if (startOfDay(start) <= endOfDay(day) && endOfDay(end) >= startOfDay(day)) found.push(event);
  }

  return found.sort(
    (a, b) => Number(b.allDay) - Number(a.allDay) || a.start.localeCompare(b.start),
  );
}

/** Tasks whose deadline lands on this day — this is how the Wheel shows up in World. */
export function tasksOnDay(state: DaytimeState, day: Date): Task[] {
  return state.tasks
    .filter((t) => t.due && isSameDay(new Date(t.due), day))
    .sort((a, b) => a.due!.localeCompare(b.due!));
}

/**
 * When a document went up on the Wall. `createdAt` was added after the first
 * documents were written, so anything older reports the only timestamp it has —
 * which for a document nobody has edited since is the same moment anyway.
 */
export function docCreatedAt(doc: Doc): string {
  return doc.createdAt ?? doc.updatedAt;
}

/**
 * Wall documents added on this day — how the Wall shows up in World, the same
 * way `tasksOnDay` is how the Wheel does. Derived rather than written out as
 * calendar rows: one document is one fact, and a stored copy would outlive the
 * document it describes.
 */
export function docsAddedOn(state: DaytimeState, day: Date): Doc[] {
  return state.docs
    .filter((d) => isSameDay(new Date(docCreatedAt(d)), day))
    .sort((a, b) => docCreatedAt(a).localeCompare(docCreatedAt(b)));
}

/**
 * One row in a day's schedule, whichever view it came from.
 *
 * The Wheel and World hold two halves of the same day: a deadline set on a
 * task and a block put on the calendar are both "something happening at 2pm",
 * and reading them in two separate lists means reading the day twice. An
 * agenda item is the shared shape that lets one timeline show both.
 */
export interface AgendaItem {
  id: string;
  kind: 'event' | 'task';
  title: string;
  /** Null when the thing has no clock time — it belongs at the foot of the day. */
  at: Date | null;
  end: Date | null;
  domainId?: string;
  priority?: Priority;
  /** Tasks only. */
  done?: boolean;
  event?: CalEvent;
  task?: Task;
}

function taskAgendaItem(task: Task): AgendaItem {
  const due = new Date(task.due!);
  // An end-of-day deadline is a day, not a moment: it has no place on the
  // clock and belongs with the to-dos underneath it.
  const timed = !(due.getHours() === 23 && due.getMinutes() === 59);
  return {
    id: task.id,
    kind: 'task',
    title: task.title,
    at: timed ? due : null,
    end: null,
    priority: task.priority,
    done: task.done,
    task,
    ...(task.domainId ? { domainId: task.domainId } : {}),
  };
}

function eventAgendaItem(event: CalEvent): AgendaItem {
  return {
    id: event.id,
    kind: 'event',
    title: event.title,
    at: event.allDay ? null : new Date(event.start),
    end: event.end ? new Date(event.end) : null,
    event,
    ...(event.domainId ? { domainId: event.domainId } : {}),
    ...(event.priority ? { priority: event.priority } : {}),
  };
}

/**
 * A day read as one schedule: everything with a time in clock order, then
 * everything without one underneath. Tasks with no date at all never appear —
 * those have no claim on any particular day and stay on the Wheel.
 */
export function dayAgenda(
  state: DaytimeState,
  day: Date,
): { timed: AgendaItem[]; untimed: AgendaItem[] } {
  const items = [
    ...eventsOnDay(state, day).map(eventAgendaItem),
    ...tasksOnDay(state, day).map(taskAgendaItem),
  ];

  const timed = items
    .filter((i) => i.at !== null)
    .sort((a, b) => a.at!.getTime() - b.at!.getTime());

  // Unfinished work sits above what's already done, and above all-day events,
  // which are context rather than something to act on.
  const untimed = items
    .filter((i) => i.at === null)
    .sort(
      (a, b) =>
        Number(a.done ?? false) - Number(b.done ?? false) ||
        Number(a.kind === 'event') - Number(b.kind === 'event'),
    );

  return { timed, untimed };
}

export function dayNote(state: DaytimeState, day: Date): string {
  return state.dayNotes.find((n) => n.date === toDateKey(day))?.body ?? '';
}

// ------------------------------------------------------------ attribution --

/**
 * A person's name as the app says it: the local part of their email, cased
 * like a name. `andrew.smith@x.com` reads "Andrew Smith". Not a lookup against
 * a member list, because attribution has to render on a document written by
 * someone who has since left, and the email on it is the only thing that
 * cannot go stale.
 */
export function personName(email: string): string {
  const local = email.split('@')[0] ?? email;
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/**
 * Who to credit on an item, or null when there is nobody worth naming — it was
 * you, or it predates authorship, or you are the only person here. Your own
 * name on your own work is noise; the whole point is spotting the other
 * person's.
 */
export function creditFor(
  item: Authored,
  me: string | null,
  names?: PeopleDirectory,
): string | null {
  if (!item.createdBy) return null;
  if (me && item.createdBy.toLowerCase() === me.toLowerCase()) return null;
  return displayName(item.createdBy, names);
}

/**
 * Email address to the name to show for it.
 *
 * Authorship is stored as an email because that is the one identifier that
 * doesn't change under you — someone editing their Google profile shouldn't
 * orphan every item they ever added. Names are resolved here at read time
 * instead, so they can improve without rewriting a single stored record.
 */
export type PeopleDirectory = Record<string, string>;

/**
 * What to call someone. A name from their account when we have one, otherwise
 * the best guess the address supports — "leila.hill@" reads as Leila Hill, but
 * "leilavhill@" can only ever come back as Leilavhill, which is exactly why
 * the directory is worth having.
 */
export function displayName(email: string, names?: PeopleDirectory): string {
  return names?.[email.toLowerCase()]?.trim() || personName(email);
}

export interface ChangeEntry {
  id: string;
  kind: 'doc' | 'event' | 'task';
  title: string;
  by: string;
  at: string;
}

/**
 * What other people have added, newest first — the feed behind the bell.
 * Only other people's work counts: a list that reminded you of your own
 * additions would never be empty, and an indicator that is never clear stops
 * meaning anything.
 */
export function recentChanges(
  state: DaytimeState,
  me: string | null,
  names?: PeopleDirectory,
): ChangeEntry[] {
  const entries: ChangeEntry[] = [];

  const take = (kind: ChangeEntry['kind'], id: string, title: string, item: Authored) => {
    const by = creditFor(item, me, names);
    const at = item.createdAt;
    if (by && at) entries.push({ id, kind, title, by, at });
  };

  for (const d of state.docs) take('doc', d.id, d.title, d);
  for (const e of state.events) take('event', e.id, e.title, e);
  for (const t of state.tasks) take('task', t.id, t.title, t);

  return entries.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 50);
}

// ---------------------------------------------------------------- messages --

/** Is this message meant for `me`? An empty `to` is addressed to everyone. */
export function addressedTo(message: Message, me: string): boolean {
  if (message.to.length === 0) return true;
  return message.to.some((email) => email.toLowerCase() === me.toLowerCase());
}

/**
 * The conversation as this person sees it: everything they sent, plus
 * everything sent to them. Messages between two other people stay out of it —
 * they are in the document, but showing them would make a mess of a feature
 * whose whole point is knowing what was meant for you.
 */
export function messagesFor(state: DaytimeState, me: string | null): Message[] {
  const all = state.messages ?? [];
  if (!me) return [];

  return all
    .filter((m) => m.from.toLowerCase() === me.toLowerCase() || addressedTo(m, me))
    .sort((a, b) => a.at.localeCompare(b.at));
}

/** Messages waiting on this person — not their own, not already opened. */
export function unreadMessages(state: DaytimeState, me: string | null): Message[] {
  if (!me) return [];
  return (state.messages ?? []).filter(
    (m) =>
      m.from.toLowerCase() !== me.toLowerCase() &&
      addressedTo(m, me) &&
      !m.readBy.some((email) => email.toLowerCase() === me.toLowerCase()),
  );
}

/** How a message's audience reads in the list: "Everyone", or the names. */
export function audienceLabel(
  message: Message,
  names: PeopleDirectory | undefined,
  me: string | null,
): string {
  if (message.to.length === 0) return 'Everyone';
  return message.to
    .map((email) =>
      me && email.toLowerCase() === me.toLowerCase() ? 'you' : displayName(email, names),
    )
    .join(', ');
}

// ------------------------------------------------------------------ search --

/**
 * Case-insensitive substring match across every word of the query, in any
 * order — "resume career" finds "Career Research Findings" the same as
 * "career resume" does. Deliberately not fuzzy: on a few dozen items an exact
 * substring is predictable, and a fuzzy match that surfaces the wrong note is
 * worse than one that surfaces nothing.
 */
function matches(haystack: string, terms: string[]): boolean {
  const hay = haystack.toLowerCase();
  return terms.every((t) => hay.includes(t));
}

export function searchTerms(query: string): string[] {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

/** Wall documents matching a query, searched over title and body alike. */
export function searchDocs(state: DaytimeState, query: string): Doc[] {
  const terms = searchTerms(query);
  if (terms.length === 0) return state.docs;

  return state.docs.filter((d) => {
    const domain = domainById(state, d.domainId)?.name ?? '';
    return matches(`${d.title} ${d.body ?? ''} ${domain}`, terms);
  });
}

/**
 * Wall documents in the order they are most likely wanted when attaching them
 * to a task: what is already attached, then anything filed under the same
 * spoke, then the rest alphabetically. A career task should surface the career
 * documents without anyone having to search for them.
 *
 * Shared by both attach points — the quick-add that creates a task and the
 * sheet that edits one — so the two can never drift into different orders.
 */
export function docsForPicking(
  state: DaytimeState,
  opts: { domainId?: string; attached?: string[]; query?: string } = {},
): Doc[] {
  const attached = opts.attached ?? [];
  const rank = (d: Doc) =>
    (attached.includes(d.id) ? 0 : 2) + (opts.domainId && d.domainId === opts.domainId ? 0 : 1);

  return [...searchDocs(state, opts.query ?? '')].sort(
    (a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title),
  );
}

export interface EventHit {
  event: CalEvent;
  /** The next occurrence at or after today, so a repeat resolves to a real date. */
  when: Date;
}

/**
 * Events matching a query, each resolved to a date you can navigate to.
 * A repeating event has no single date of its own, so it reports its next
 * occurrence rather than the day the rule was first written.
 */
export function searchEvents(state: DaytimeState, query: string, from: Date): EventHit[] {
  const terms = searchTerms(query);
  if (terms.length === 0) return [];

  const hits: EventHit[] = [];
  for (const event of state.events) {
    const domain = domainById(state, event.domainId)?.name ?? '';
    if (!matches(`${event.title} ${event.location ?? ''} ${domain}`, terms)) continue;

    if (!event.recurrence) {
      hits.push({ event, when: new Date(event.start) });
      continue;
    }
    // Walk forward to the next day the rule lands on. A week is enough for
    // every recurrence this app supports.
    let day = startOfDay(from);
    for (let i = 0; i < 8; i += 1) {
      if (repeatsOn(event, day)) {
        hits.push({ event, when: new Date(occurrenceOn(event, day).start) });
        break;
      }
      day = new Date(day.getTime() + 24 * 60 * 60 * 1000);
    }
  }

  return hits.sort((a, b) => a.when.getTime() - b.when.getTime());
}

/** Tasks matching a query. Only dated ones can be pointed at on a calendar. */
export function searchTasks(state: DaytimeState, query: string): Task[] {
  const terms = searchTerms(query);
  if (terms.length === 0) return [];

  return state.tasks
    .filter((t) => {
      const domain = domainById(state, t.domainId)?.name ?? '';
      return matches(`${t.title} ${t.notes ?? ''} ${domain}`, terms);
    })
    .sort((a, b) => (a.due ?? '~').localeCompare(b.due ?? '~'));
}

export function domainById(state: DaytimeState, id: string | undefined): Domain | undefined {
  if (!id) return undefined;
  return state.domains.find((d) => d.id === id);
}
