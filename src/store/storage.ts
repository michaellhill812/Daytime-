import type { DaytimeState } from '../types';

export const SCHEMA_VERSION = 1;

/**
 * Everything the app needs from persistence. The interface is async so a
 * networked/synced adapter can replace the local one later without touching a
 * single view — the store awaits hydration before the first render either way.
 */
export interface StorageAdapter {
  load(): Promise<DaytimeState | null>;
  save(state: DaytimeState): Promise<void>;
  clear(): Promise<void>;
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
      return parsed;
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
