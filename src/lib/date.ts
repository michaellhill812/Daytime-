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

/**
 * Human label for a deadline: "2d overdue", "6:30pm", "Tomorrow", "Fri", "Sep 3".
 * Deliberately terse — these render inside dense list rows.
 */
export function dueLabel(due: string, now: Date): string {
  const d = new Date(due);
  const today = startOfDay(now);
  const target = startOfDay(d);
  const days = Math.round((target.getTime() - today.getTime()) / DAY_MS);

  if (days < 0) {
    const n = Math.abs(days);
    return n === 1 ? 'Yesterday' : `${n}d overdue`;
  }
  if (days === 0) return formatTime(d);
  if (days === 1) return 'Tomorrow';
  if (days < 7) return d.toLocaleDateString(undefined, { weekday: 'short' });
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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
