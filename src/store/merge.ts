import type { CalEvent, DayNote, DaytimeState, Doc, Domain, Goal, Message, Task } from '../types';

/**
 * Three-way merge of two Daytime documents against the last revision both sides
 * agreed on.
 *
 * The state is stored as one JSON document, so a naive last-write-wins would
 * throw away a whole edit whenever two people saved within the same moment —
 * including edits to completely unrelated things. Merging per entity against a
 * common base fixes the case that actually happens: two people working in
 * different parts of the app at the same time.
 *
 * The base is what makes deletion work without tombstones. An id missing from
 * one side means "deleted" only if it was in the base; otherwise it means the
 * other side just added it.
 *
 * The one case this cannot resolve is both sides editing the *same* entity
 * between saves. There the local edit wins, because the person who caused this
 * save is the one still looking at the screen.
 */

/** JSON with sorted keys, so equality does not depend on property order. */
function stable(value: unknown): string {
  return JSON.stringify(value, (_k, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as object).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  );
}

function index<T>(items: T[], keyOf: (item: T) => string): Map<string, T> {
  return new Map(items.map((item) => [keyOf(item), item]));
}

function mergeCollection<T>(
  baseItems: T[],
  localItems: T[],
  remoteItems: T[],
  keyOf: (item: T) => string,
): T[] {
  const base = index(baseItems, keyOf);
  const local = index(localItems, keyOf);
  const remote = index(remoteItems, keyOf);

  const out: T[] = [];
  const taken = new Set<string>();

  const resolve = (id: string): T | null => {
    const l = local.get(id);
    const r = remote.get(id);
    const b = base.get(id);

    if (l && r) {
      if (stable(l) === stable(r)) return l;
      // Whichever side still matches the base is the one that did not edit.
      if (b && stable(l) === stable(b)) return r;
      if (b && stable(r) === stable(b)) return l;
      return l; // both edited it — the local writer wins
    }
    if (l && !r) return b ? null : l; // in base → remote deleted it; else local added it
    if (!l && r) return b ? null : r; // in base → local deleted it; else remote added it
    return null;
  };

  // Local order first, so the person saving sees their own arrangement kept.
  for (const item of localItems) {
    const id = keyOf(item);
    const merged = resolve(id);
    taken.add(id);
    if (merged) out.push(merged);
  }
  for (const item of remoteItems) {
    const id = keyOf(item);
    if (taken.has(id)) continue;
    const merged = resolve(id);
    if (merged) out.push(merged);
  }

  return out;
}

const byId = <T extends { id: string }>(item: T) => item.id;
const byDate = (note: DayNote) => note.date;

export function mergeStates(
  base: DaytimeState,
  local: DaytimeState,
  remote: DaytimeState,
): DaytimeState {
  return {
    version: Math.max(local.version, remote.version),
    domains: mergeCollection<Domain>(base.domains, local.domains, remote.domains, byId),
    goals: mergeCollection<Goal>(base.goals, local.goals, remote.goals, byId),
    tasks: mergeCollection<Task>(base.tasks, local.tasks, remote.tasks, byId),
    docs: mergeCollection<Doc>(base.docs, local.docs, remote.docs, byId),
    events: mergeCollection<CalEvent>(base.events, local.events, remote.events, byId),
    dayNotes: mergeCollection<DayNote>(base.dayNotes, local.dayNotes, remote.dayNotes, byDate),
    messages: mergeCollection<Message>(
      base.messages ?? [],
      local.messages ?? [],
      remote.messages ?? [],
      byId,
    ),
  };
}
