import { useEffect, useRef, useState } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import App from '../App';
import SignIn from './SignIn';
import WorkspaceSheet from './WorkspaceSheet';
import { StoreProvider } from '../store/context';
import { DaytimeStore } from '../store/store';
import { LocalStorageAdapter } from '../store/storage';
import { createSeedState } from '../data/seed';
import { SupabaseAdapter, ensureWorkspace, type SyncStatus } from './supabaseAdapter';
import { explainSupabaseError } from './explainError';
import type { PeopleDirectory } from '../store/selectors';

/**
 * Everyone's display name, keyed by the email their work is filed under.
 *
 * Best-effort on purpose: a workspace that can't answer just falls back to
 * names derived from the addresses, which is what the app did before this
 * existed. Failing to boot over a cosmetic label would be a poor trade.
 */
async function loadPeople(client: SupabaseClient, workspaceId: string): Promise<PeopleDirectory> {
  try {
    const { data, error } = await client.rpc('workspace_people', { p_workspace: workspaceId });
    if (error || !Array.isArray(data)) return {};

    const directory: PeopleDirectory = {};
    for (const row of data as { email?: string; name?: string | null }[]) {
      if (row.email && row.name) directory[row.email.toLowerCase()] = row.name;
    }
    return directory;
  } catch {
    return {};
  }
}

type Phase =
  | { kind: 'loading' }
  | { kind: 'signed-out' }
  | { kind: 'ready'; store: DaytimeStore; workspaceId: string }
  | { kind: 'error'; message: string };

/**
 * Everything between "the page opened" and "the app can render": wait for a
 * session, find the workspace, load its document, and hand the views a store
 * that happens to be backed by Postgres instead of localStorage.
 */
export default function CloudBoot({ client }: { client: SupabaseClient }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [status, setStatus] = useState<SyncStatus>('synced');
  const [panelOpen, setPanelOpen] = useState(false);
  const adapterRef = useRef<SupabaseAdapter | null>(null);

  useEffect(() => {
    void client.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = client.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, [client]);

  useEffect(() => {
    if (session === undefined) return;
    if (session === null) {
      setPhase({ kind: 'signed-out' });
      return;
    }

    let disposed = false;
    let disconnect: (() => void) | null = null;

    (async () => {
      try {
        const workspaceId = await ensureWorkspace(client);
        const adapter = new SupabaseAdapter(client, workspaceId, setStatus);
        adapterRef.current = adapter;

        let state = await adapter.load();

        if (!state) {
          // First run for this workspace. Anything already in this browser is
          // the user's real work, so it becomes the starting document rather
          // than being replaced by a fresh seed.
          const local = await new LocalStorageAdapter().load();
          state = local ?? createSeedState(new Date());
          await adapter.save(state);
        }

        if (disposed) return;

        const store = new DaytimeStore(state, adapter);
        // Set before anything can be created, so nothing is ever written
        // without an author in a workspace that has one.
        store.actor = session.user.email ?? null;
        store.people = await loadPeople(client, workspaceId);
        disconnect = store.connect();
        setPhase({ kind: 'ready', store, workspaceId });
      } catch (err) {
        if (!disposed) {
          setPhase({ kind: 'error', message: explainSupabaseError(err) });
        }
      }
    })();

    return () => {
      disposed = true;
      disconnect?.();
      adapterRef.current?.dispose();
      adapterRef.current = null;
    };
  }, [client, session]);

  if (phase.kind === 'signed-out') return <SignIn client={client} />;

  if (phase.kind === 'error') {
    return (
      <div className="gate">
        <div className="gate__card">
          <h1 className="gate__title">Can’t reach the workspace</h1>
          <p className="gate__error">{phase.message}</p>
          <button type="button" className="gate__alt" onClick={() => window.location.reload()}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (phase.kind === 'loading') {
    return (
      <div className="gate">
        <div className="gate__card">
          <p className="gate__text">Opening your workspace…</p>
        </div>
      </div>
    );
  }

  return (
    <StoreProvider store={phase.store}>
      <App />
      <button
        type="button"
        className={`account account--${status}`}
        onClick={() => setPanelOpen(true)}
        title={session?.user.email ?? 'Workspace'}
        aria-label="Workspace"
      >
        {(session?.user.email ?? '?').slice(0, 1).toUpperCase()}
      </button>
      {panelOpen && (
        <WorkspaceSheet
          client={client}
          workspaceId={phase.workspaceId}
          email={session?.user.email ?? ''}
          onClose={() => setPanelOpen(false)}
        />
      )}
    </StoreProvider>
  );
}
