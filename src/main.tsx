import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { StoreProvider } from './store/context';
import { DaytimeStore } from './store/store';
import { LocalStorageAdapter, withDefaults } from './store/storage';
import { createSeedState } from './data/seed';
import { cloudEnabled, cloudUrlProblem } from './cloud/config';
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
  // withDefaults on both branches, so a fresh seed and a loaded document enter
  // the app through exactly one gate — imports included.
  const initial = withDefaults(saved ?? createSeedState(new Date()));
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
  // Say what is wrong with the configuration here, where it is still one
  // sentence away from the cause. Left to fail on its own it surfaces as an
  // opaque network error inside the first request.
  if (cloudUrlProblem) {
    mount(<ConfigError message={cloudUrlProblem} />);
    return;
  }

  const [{ createSupabaseClient }, { default: CloudBoot }] = await Promise.all([
    import('./cloud/supabaseAdapter'),
    import('./cloud/CloudBoot'),
  ]);
  mount(<CloudBoot client={createSupabaseClient()} />);
}

function ConfigError({ message }: { message: string }) {
  return (
    <div className="boot">
      <div className="boot__panel">
        <h1 className="boot__title">Daytime can’t reach its database</h1>
        <p className="boot__body">{message}</p>
        <p className="boot__hint">
          Fix the value in Vercel under Settings → Environment Variables, then redeploy.
        </p>
      </div>
    </div>
  );
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
