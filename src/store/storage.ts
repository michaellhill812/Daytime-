import type { DaytimeState } from '../types';

/**
 * A version mismatch discards the saved state and re-seeds.
 *   2 — placeholder dataset replaced with real reference documents
 *   3 — Daily Routine and 60s Reset domains added
 *   4 — Self-Care merge, Finances + Sessions domains, verbatim document bodies
 *   5 — workshop worksheets added; Daily Schedule title trimmed
 *   6 — the four next steps as tasks; the daily schedule as repeating events
 */
export const SCHEMA_VERSION = 6;

/**
 * Fill in anything a stored document predates.
 *
 * Deliberately not a version bump: a mismatch discards the saved state and
 * re-seeds, which for a live shared workspace means throwing away real work.
 * An additive field with a default costs nothing and loses nothing, so every
 * adapter runs its loaded document through here rather than raising the
 * version and orphaning what people already have.
 */
export function withDefaults(state: DaytimeState): DaytimeState {
  return state.messages ? state : { ...state, messages: [] };
}

/**
 * Everything the app needs from persistence. The interface is async so a
 * networked/synced adapter can replace the local one later without touching a
 * single view — the store awaits hydration before the first render either way.
 */
export interface StorageAdapter {
  load(): Promise<DaytimeState | null>;
  save(state: DaytimeState): Promise<void>;
  clear(): Promise<void>;
  /**
   * Optional: push changes made elsewhere into this client. Returns an
   * unsubscribe. Adapters without a backend simply omit it.
   */
  subscribe?(onRemote: (state: DaytimeState) => void): () => void;
}

const KEY = 'daytime.state.v1';

export class LocalStorageAdapter implements StorageAdapter {
  constructor(private readonly key: string = KEY) {}

  async load(): Promise<DaytimeState | null> {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(this.key);
    } catch {
      // Private-mode Safari and friends. Fall through to a seeded session.
      return null;
    }
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as DaytimeState;
      if (parsed?.version !== SCHEMA_VERSION) return null;
      return withDefaults(parsed);
    } catch {
      return null;
    }
  }

  async save(state: DaytimeState): Promise<void> {
    try {
      localStorage.setItem(this.key, JSON.stringify(state));
    } catch {
      // Out of quota or storage blocked — the session stays usable in memory.
    }
  }

  async clear(): Promise<void> {
    try {
      localStorage.removeItem(this.key);
    } catch {
      /* nothing to undo */
    }
  }
}

/** In-memory adapter, useful for tests and for a "try it" mode that leaves no trace. */
export class MemoryStorageAdapter implements StorageAdapter {
  private snapshot: DaytimeState | null = null;

  async load() {
    return this.snapshot;
  }

  async save(state: DaytimeState) {
    this.snapshot = state;
  }

  async clear() {
    this.snapshot = null;
  }
}
