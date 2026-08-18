/**
 * Core domain model for Daytime.
 *
 * The three views are different projections of this one dataset:
 *   Wheel  → domains + goals + tasks
 *   Wall   → docs
 *   World  → events + dayNotes + tasks that carry a due date
 *
 * Cross-view links live on Task (`docIds`, `eventIds`) and as the optional
 * `domainId` on Doc/CalEvent. Reverse lookups are derived in selectors rather
 * than stored, so there is exactly one place a link can go stale.
 */

/** 3 = high, 2 = medium, 1 = low. Ordered so numeric comparison is meaningful. */
export type Priority = 1 | 2 | 3;

export interface Domain {
  id: string;
  name: string;
  /** Hex accent used for the spoke and domain chrome. The ring uses priority colors instead. */
  accent: string;
  order: number;
  /**
   * A document that *is* this domain, rather than one filed under it — a
   * routine, a procedure, something you open the spoke to read. When set, the
   * domain leads with this document's text instead of with a task list.
   */
  guideDocId?: string;
}

export interface Goal {
  id: string;
  domainId: string;
  title: string;
  horizon: 'short' | 'long';
  /** ISO date (YYYY-MM-DD), optional. */
  target?: string;
  /** 0..1 */
  progress: number;
}

export interface Task {
  id: string;
  domainId: string;
  title: string;
  notes?: string;
  priority: Priority;
  /** ISO datetime. Absent means "someday" — it still counts, it just has no clock on it. */
  due?: string;
  done: boolean;
  completedAt?: string;
  /** Wall documents this task refers to. */
  docIds: string[];
  /** World events this task is attached to. */
  eventIds: string[];
}

export type DocKind = 'note' | 'link' | 'image' | 'file';

/** A Wall item — the digital equivalent of something pinned above a desk. */
export interface Doc {
  id: string;
  title: string;
  kind: DocKind;
  domainId?: string;
  /** Body text for `note`, or a short description for the other kinds. */
  body?: string;
  url?: string;
  /**
   * Key of a diagram to render above the body — for source documents whose
   * content is a drawing rather than text. Kept as a key, not markup, so the
   * drawing lives in code and the data stays plain.
   */
  diagram?: string;
  /** Pinned docs sort to the front of the Wall. */
  pinned: boolean;
  updatedAt: string;
}

export interface CalEvent {
  id: string;
  title: string;
  domainId?: string;
  /** ISO datetime. */
  start: string;
  /** ISO datetime. Absent means a point in time rather than a span. */
  end?: string;
  allDay: boolean;
  location?: string;
}

/** One free-text note per calendar day: what actually happened. */
export interface DayNote {
  /** YYYY-MM-DD */
  date: string;
  body: string;
}

export interface DaytimeState {
  version: number;
  domains: Domain[];
  goals: Goal[];
  tasks: Task[];
  docs: Doc[];
  events: CalEvent[];
  dayNotes: DayNote[];
}

export type ViewId = 'wheel' | 'wall' | 'world';
