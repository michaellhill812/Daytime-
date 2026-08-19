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

/**
 * Who made a thing, and when.
 *
 * Both optional, and deliberately so: everything written before these existed
 * has neither, and a single-user workspace has nobody to attribute anything
 * to. The author is stored as the email that made it rather than an id
 * pointing at a member row — a name that survives on its own needs no lookup
 * to render, and no join to stay correct.
 */
export interface Authored {
  createdBy?: string;
  createdAt?: string;
}

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

export interface Task extends Authored {
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
export interface Doc extends Authored {
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
  /* `createdAt` (from Authored) is what World shows on the day it was added.
     Documents written before that field existed fall back to `updatedAt` via
     `docCreatedAt`. */
}

/** How an event repeats. Absent means it happens once. */
export type Recurrence = 'daily' | 'weekdays';

export interface CalEvent extends Authored {
  id: string;
  title: string;
  domainId?: string;
  /** ISO datetime. For a repeating event this is the first occurrence. */
  start: string;
  /** ISO datetime. Absent means a point in time rather than a span. */
  end?: string;
  allDay: boolean;
  location?: string;
  /** Optional — an event is a commitment first; how much it matters is extra. */
  priority?: Priority;
  /**
   * Repeats are stored as one row and expanded when a day is read, rather than
   * written out as hundreds of copies. Editing the rule then stays a single
   * edit, and the calendar extends forever without the data growing.
   */
  recurrence?: Recurrence;
}

/**
 * A note passed between people in the workspace.
 *
 * Addressed, not private. The whole workspace is one shared document, so a
 * message named for one person is still carried in everyone's copy — `to`
 * says who it is *for*, and the app shows it only to them, but it is not
 * hidden from anyone determined to look. Real privacy would need messages in
 * their own table with their own row-level rules.
 */
export interface Message {
  id: string;
  body: string;
  /** Sender's email — the same identifier authorship uses. */
  from: string;
  /** Recipients' emails. Empty means everyone in the workspace. */
  to: string[];
  at: string;
  /** Emails that have opened it, so a read on one device is read on all. */
  readBy: string[];
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
  /**
   * Optional in the type because documents written before messaging existed
   * don't carry it. `withDefaults` fills it in on load, so everything past
   * the storage layer can treat it as present.
   */
  messages?: Message[];
}

export type ViewId = 'wheel' | 'wall' | 'world';
