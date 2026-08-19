import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { DaytimeState } from '../types';
import { withDefaults, type StorageAdapter } from '../store/storage';
import { mergeStates } from '../store/merge';
import { cloudCredentials } from './config';

export type SyncStatus = 'synced' | 'saving' | 'error';

export function createSupabaseClient(): SupabaseClient {
  const { url, anonKey } = cloudCredentials();
  return createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
}

export async function ensureWorkspace(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.rpc('ensure_workspace');
  if (error) throw error;
  return data as string;
}

interface SaveResult {
  ok: boolean;
  version: number;
  state: DaytimeState;
}

/**
 * Stores the whole Daytime document in one row and writes it through a
 * compare-and-swap RPC.
 *
 * Two things make that safe enough to share. Writes carry the version the
 * client last saw, so a concurrent write is refused rather than silently
 * overwriting; and the refusal comes back with the winner's document attached,
 * which is merged against the last agreed revision and retried — so an edit
 * made at the same moment in a different part of the app survives instead of
 * being thrown away.
 */
export class SupabaseAdapter implements StorageAdapter {
  /** The last revision this client and the server both agreed on. */
  private base: DaytimeState | null = null;
  private version = 0;
  private onRemote: ((state: DaytimeState) => void) | null = null;
  private queue: Promise<void> = Promise.resolve();
  private detach: (() => void) | null = null;

  constructor(
    private readonly client: SupabaseClient,
    private readonly workspaceId: string,
    private readonly onStatus?: (status: SyncStatus) => void,
  ) {}

  async load(): Promise<DaytimeState | null> {
    const { data, error } = await this.client
      .from('workspace_state')
      .select('state, version')
      .eq('workspace_id', this.workspaceId)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      this.version = 0;
      this.base = null;
      return null;
    }

    this.version = Number(data.version);
    this.base = withDefaults(data.state as DaytimeState);
    return this.base;
  }

  save(state: DaytimeState): Promise<void> {
    // One write at a time: two in flight would race on `version` and each
    // other's merges.
    this.queue = this.queue.then(async () => {
      this.onStatus?.('saving');
      try {
        await this.write(state);
        this.onStatus?.('synced');
      } catch (err) {
        this.onStatus?.('error');
        console.error('[daytime] save failed', err);
      }
    });
    return this.queue;
  }

  private async write(state: DaytimeState, attempt = 0): Promise<void> {
    const { data, error } = await this.client.rpc('save_state', {
      p_workspace: this.workspaceId,
      p_state: state,
      p_expected: this.version,
    });
    if (error) throw error;

    const row = (Array.isArray(data) ? data[0] : data) as SaveResult;

    if (row.ok) {
      this.version = Number(row.version);
      this.base = state;
      // A merged document is not what the user had on screen — show it to them.
      if (attempt > 0) this.onRemote?.(state);
      return;
    }

    const remote = row.state;
    this.version = Number(row.version);
    const merged = mergeStates(this.base ?? remote, state, remote);

    if (attempt >= 3) {
      // Someone is writing continuously. Take their document plus our merge and
      // stop fighting for the write.
      this.base = remote;
      this.onRemote?.(merged);
      return;
    }

    return this.write(merged, attempt + 1);
  }

  async clear(): Promise<void> {
    // Deliberately not destructive: dropping a shared workspace's document is
    // not something a local "clear" should be able to do.
    this.base = null;
    this.version = 0;
  }

  /** Live updates from anyone else editing this workspace. */
  subscribe(onRemote: (state: DaytimeState) => void): () => void {
    this.onRemote = onRemote;

    const channel = this.client
      .channel(`workspace_state:${this.workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workspace_state',
          filter: `workspace_id=eq.${this.workspaceId}`,
        },
        (payload) => {
          const next = payload.new as { version?: number; state?: DaytimeState };
          if (!next?.state || next.version === undefined) return;
          // Our own write echoes back at the version we already hold.
          if (Number(next.version) === this.version) return;

          // A peer still running an older build can write a document without
          // the newer fields; default them here too, not just on first load.
          const incoming = withDefaults(next.state);
          this.version = Number(next.version);
          this.base = incoming;
          onRemote(incoming);
        },
      )
      .subscribe();

    this.detach = () => {
      void this.client.removeChannel(channel);
      this.onRemote = null;
    };
    return this.detach;
  }

  dispose(): void {
    this.detach?.();
  }
}
