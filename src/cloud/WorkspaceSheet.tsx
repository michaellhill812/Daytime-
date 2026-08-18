import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import Sheet from '../components/Sheet';

interface Person {
  email: string;
  role: string;
  pending: boolean;
}

/** Who can see this workspace, and how to add someone. */
export default function WorkspaceSheet({
  client,
  workspaceId,
  email,
  onClose,
}: {
  client: SupabaseClient;
  workspaceId: string;
  email: string;
  onClose: () => void;
}) {
  const [people, setPeople] = useState<Person[]>([]);
  const [invite, setInvite] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = async () => {
    const { data, error: err } = await client.rpc('workspace_people', { p_workspace: workspaceId });
    if (err) {
      setError(err.message);
      return;
    }
    setPeople((data as Person[]) ?? []);
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  const send = async () => {
    const address = invite.trim();
    if (!address) return;
    setBusy(true);
    setError('');
    const { error: err } = await client.rpc('invite_member', {
      p_workspace: workspaceId,
      p_email: address,
      p_role: 'editor',
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setInvite('');
    void refresh();
  };

  return (
    <Sheet open onClose={onClose} title="Workspace" subtitle={email}>
      <section className="block">
        <h3 className="block__title">
          People<span className="block__count">{people.length}</span>
        </h3>
        <div className="list">
          {people.map((p) => (
            <div key={p.email} className="person">
              <span className="person__email">{p.email}</span>
              <span className="person__role">{p.pending ? 'invited' : p.role}</span>
            </div>
          ))}
          {people.length === 0 && <p className="empty">Just you so far.</p>}
        </div>
      </section>

      <section className="block">
        <h3 className="block__title">Invite</h3>
        <div className="quick-add">
          <input
            className="field"
            type="email"
            inputMode="email"
            placeholder="their@email.com"
            value={invite}
            onChange={(e) => setInvite(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void send();
            }}
          />
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => void send()}
            disabled={!invite.trim() || busy}
          >
            Add
          </button>
        </div>
        <p className="block__hint">
          They can sign in with that address whenever they like — the invitation waits for them.
        </p>
        {error && <p className="gate__error">{error}</p>}
      </section>

      <div className="row-actions">
        <button type="button" className="btn" onClick={() => void client.auth.signOut()}>
          Sign out
        </button>
      </div>
    </Sheet>
  );
}
