import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from '../../src/App';
import { StoreProvider } from '../../src/store/context';
import { DaytimeStore } from '../../src/store/store';
import { LocalStorageAdapter } from '../../src/store/storage';
import { createSeedState } from '../../src/data/seed';
import '../../src/index.css';

/**
 * The whole app, over localStorage, but signed in as whoever `?me=` says.
 *
 * Anything that depends on *who is looking* — authorship credit, the updates
 * bell, and notes addressed to one person — is invisible in the plain local
 * build, which has no actor at all. Opening several pages of this in one
 * browser context gives several people sharing one document, which is as
 * close to the real thing as it gets without a network.
 *
 *   ?me=leila@example.com
 *
 * Andrew is deliberately left nameless: a workspace member who has never
 * signed in has no account name, and must still be addressable.
 */

const PEOPLE = {
  'michael@example.com': 'Michael Hill',
  'leila@example.com': 'Leila Hill',
  'andrew@example.com': '',
};

async function boot() {
  const params = new URLSearchParams(window.location.search);
  const adapter = new LocalStorageAdapter();
  const saved = await adapter.load();

  const store = new DaytimeStore(saved ?? createSeedState(new Date()), adapter);
  if (!saved) store.flush();

  // Both before the first render: the bubble's unread count is derived from
  // the actor, so a page that mounts without one paints a wrong badge first.
  store.actor = params.get('me');
  store.people = PEOPLE;

  const el = document.getElementById('root');
  if (!el) throw new Error('#root missing');
  createRoot(el).render(
    <StrictMode>
      <StoreProvider store={store}>
        <App />
      </StoreProvider>
    </StrictMode>,
  );
}

void boot();
