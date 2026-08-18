import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { StoreProvider } from './store/context';
import { DaytimeStore } from './store/store';
import { LocalStorageAdapter } from './store/storage';
import { createSeedState } from './data/seed';
import { cloudEnabled } from './cloud/config';
import './index.css';

function mount(node: React.ReactNode) {
  const el = document.getElementById('root');
  if (!el) throw new Error('#root missing');
  createRoot(el).render(<StrictMode>{node}</StrictMode>);
}

/** Local-only: everything in this browser, no auth, no network. */
async function bootLocal() {
  const adapter = new LocalStorageAdapter();
  const saved = await adapter.load();

  // Hydration is awaited before the first paint, so the app never flashes seed
  // data over real data.
  const initial = saved ?? createSeedState(new Date());
  const store = new DaytimeStore(initial, adapter);
  if (!saved) store.flush();

  mount(
    <StoreProvider store={store}>
      <App />
    </StoreProvider>,
  );
}

/** Cloud: sign in, then the same app over a shared document. */
async function bootCloud() {
  const [{ createSupabaseClient }, { default: CloudBoot }] = await Promise.all([
    import('./cloud/supabaseAdapter'),
    import('./cloud/CloudBoot'),
  ]);
  mount(<CloudBoot client={createSupabaseClient()} />);
}

// __CLOUD_BUILD__ is false in the embed build, which lets the bundler drop
// bootCloud and every module it imports.
void (__CLOUD_BUILD__ && cloudEnabled ? bootCloud() : bootLocal());

// Only the top-level app installs a worker: an embedded copy has no business
// claiming the host origin's scope, and /sw.js won't exist there anyway.
if ('serviceWorker' in navigator && import.meta.env.PROD && window.top === window.self) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // No worker means no offline shell — the app itself is unaffected.
    });
  });
}
