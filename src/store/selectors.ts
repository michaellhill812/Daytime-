import type { CalEvent, DaytimeState, Doc, Domain, Goal, Priority, Task } from '../types';
import { endOfDay, isSameDay, startOfDay, toDateKey } from '../lib/date';

/**
 * Ring / status colors.
 *
 * The ring answers two questions at once: how much of a domain is finished
 * (arc fill) and how hot the unfinished part is (arc hue). Red high, blue low,
 * green done — with amber in the middle so "medium" doesn't have to borrow one
 * of the extremes.
 */
export const PRIORITY_COLOR: Record<Priority, string> = {
  3: '#FF453A',
  2: '#FF9F0A',
  1: '#0A84FF',
};
export const DONE_COLOR = '#30D158';
export const EMPTY_COLOR = '#2A2E38';

export const PRIORITY_LABEL: Record<Priority, string> = {
  3: 'High',
  2: 'Medium',
  1: 'Low',
};

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

export interface RingSegment {
  domain: Domain;
  total: number;
  done: number;
  /** 0..1 — the share of this domain's arc that is filled. */
  completion: number;
  /** Arc hue: the hottest open priority, or green when nothing is open. */
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

    let color: string;
    if (tasks.length === 0) color = EMPTY_COLOR;
    else if (topPriority === null) color = DONE_COLOR;
    else color = PRIORITY_COLOR[topPriority];

    return {
      domain,
      total: tasks.length,
      done,
      completion: tasks.length === 0 ? 0 : done / tasks.length,
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

export function eventsOnDay(state: DaytimeState, day: Date): CalEvent[] {
  return state.events
    .filter((e) => {
      const start = new Date(e.start);
      const end = e.end ? new Date(e.end) : start;
      // Multi-day events show on every day they span.
      return startOfDay(start) <= endOfDay(day) && endOfDay(end) >= startOfDay(day);
    })
    .sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.localeCompare(b.start));
}

/** Tasks whose deadline lands on this day — this is how the Wheel shows up in World. */
export function tasksOnDay(state: DaytimeState, day: Date): Task[] {
  return state.tasks
    .filter((t) => t.due && isSameDay(new Date(t.due), day))
    .sort((a, b) => a.due!.localeCompare(b.due!));
}

export function dayNote(state: DaytimeState, day: Date): string {
  return state.dayNotes.find((n) => n.date === toDateKey(day))?.body ?? '';
}

export function domainById(state: DaytimeState, id: string | undefined): Domain | undefined {
  if (!id) return undefined;
  return state.domains.find((d) => d.id === id);
}
