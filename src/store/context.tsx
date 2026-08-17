import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from 'react';
import type { DaytimeState } from '../types';
import { DaytimeStore } from './store';

const StoreContext = createContext<DaytimeStore | null>(null);

export function StoreProvider({ store, children }: { store: DaytimeStore; children: ReactNode }) {
  // A backgrounded tab can be discarded without warning; flush before that happens.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') store.flush();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', store.flush);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', store.flush);
      store.flush();
    };
  }, [store]);

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore(): DaytimeStore {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside <StoreProvider>');
  return store;
}

/**
 * Subscribes to the whole state object. The store swaps identity on every
 * write, so this is a plain reference comparison — derive slices with `useMemo`
 * in the component rather than passing selectors through here.
 */
export function useDaytimeState(): DaytimeState {
  const store = useStore();
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}
