import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { StoreProvider } from './store/context';
import { DaytimeStore } from './store/store';
import { LocalStorageAdapter } from './store/storage';
import { createSeedState } from './data/seed';
import './index.css';

async function boot() {
  const adapter = new LocalStorageAdapter();
  const saved = await adapter.load();

  // Hydration is awaited before the first paint, so the app never flashes seed
  // data over real data — and an async/remote adapter later needs no changes here.
  const initial = saved ?? createSeedState(new Date());
  const store = new DaytimeStore(initial, adapter);
  if (!saved) store.flush();

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

// Only the top-level app installs a worker: an embedded copy has no business
// claiming the host origin's scope, and /sw.js won't exist there anyway.
if ('serviceWorker' in navigator && import.meta.env.PROD && window.top === window.self) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // No worker means no offline shell — the app itself is unaffected.
    });
  });
}
