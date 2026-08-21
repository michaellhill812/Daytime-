/** Small date helpers. Everything is local-time; keys are YYYY-MM-DD. */

export const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

export function endOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(23, 59, 59, 999);
  return out;
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

export function addMonths(d: Date, n: number): Date {
  const out = new Date(d.getFullYear(), d.getMonth() + n, 1);
  return out;
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** YYYY-MM-DD in local time (not UTC — `toISOString` would shift the day). */
export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

/**
 * The end-of-day minute a date-only deadline is stored at. A task due "on
 * Thursday" is due by the end of Thursday, and this is the one minute that
 * means "no particular time" rather than a time somebody chose.
 */
export const END_OF_DAY = { h: 23, m: 59 } as const;

/** `<input type="time">` value for a deadline, or '' when it is end-of-day. */
export function toTimeInput(iso: string): string {
  const d = new Date(iso);
  if (d.getHours() === END_OF_DAY.h && d.getMinutes() === END_OF_DAY.m) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Build a deadline from the two inputs. Assembled from parts rather than
 * parsed: `new Date('2026-03-04')` is UTC midnight, which is the previous day
 * for anyone west of Greenwich. An empty date means no deadline at all.
 */
export function fromDateTimeInputs(date: string, time: string): string | undefined {
  if (!date) return undefined;
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time ? time.split(':').map(Number) : [END_OF_DAY.h, END_OF_DAY.m];
  return new Date(
    y ?? 1970,
    (mo ?? 1) - 1,
    d ?? 1,
    h ?? END_OF_DAY.h,
    mi ?? END_OF_DAY.m,
    0,
    0,
  ).toISOString();
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatTime(d: Date): string {
  return d
    .toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    .replace(/\s/g, '')
    .toLowerCase();
}

export function formatMonthYear(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export function formatDayLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

export function formatShortDay(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

/** True when a deadline names a moment, rather than just the day it falls on. */
export function isTimed(iso: string): boolean {
  return toTimeInput(iso) !== '';
}

/**
 * Human label for a deadline: "2d overdue", "6:30pm", "Tomorrow 2:30pm",
 * "Fri", "Sep 3 9am". Deliberately terse — these render inside dense list rows.
 *
 * The time is shown whenever the task actually carries one, and withheld when
 * it does not. A task due "tomorrow" with no time is stored at 23:59, so
 * printing the clock unconditionally would invent a 11:59pm deadline nobody
 * chose — the same fabricated precision World avoids by saying "to-do".
 */
export function dueLabel(due: string, now: Date): string {
  const d = new Date(due);
  const today = startOfDay(now);
  const target = startOfDay(d);
  const days = Math.round((target.getTime() - today.getTime()) / DAY_MS);
  const timed = isTimed(due);

  // Overdue answers "how late", not "when" — a clock time here is noise.
  if (days < 0) {
    const n = Math.abs(days);
    return n === 1 ? 'Yesterday' : `${n}d overdue`;
  }

  // Today needs no day word; the time alone is unambiguous, and is the whole
  // point of the row when there is one.
  if (days === 0) return timed ? formatTime(d) : 'Today';

  const day =
    days === 1
      ? 'Tomorrow'
      : days < 7
        ? d.toLocaleDateString(undefined, { weekday: 'short' })
        : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  return timed ? `${day} ${formatTime(d)}` : day;
}

/**
 * Six-week grid (42 cells) covering the month `anchor` falls in, padded with
 * neighbouring days so the calendar never reflows between months.
 */
export function monthGrid(anchor: Date): Date[] {
  const first = startOfMonth(anchor);
  const leading = first.getDay(); // 0 = Sunday
  const gridStart = addDays(first, -leading);
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}
