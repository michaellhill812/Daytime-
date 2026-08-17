import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import DocSheet from './DocSheet';
import EventSheet from './EventSheet';

interface PeekApi {
  /** Open a Wall document from anywhere — Wheel, Wall, or World. */
  openDoc: (id: string) => void;
  /** Open a World event from anywhere. */
  openEvent: (id: string) => void;
}

const PeekContext = createContext<PeekApi | null>(null);

/**
 * Cross-view detail. A task in the Wheel can point at a document on the Wall
 * and an event in World; rather than teleporting the user between views, the
 * linked item surfaces in place. One provider, so any view gets this for free.
 */
export function PeekProvider({ children }: { children: ReactNode }) {
  const [docId, setDocId] = useState<string | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);

  const api = useMemo<PeekApi>(
    () => ({
      openDoc: (id) => {
        setEventId(null);
        setDocId(id);
      },
      openEvent: (id) => {
        setDocId(null);
        setEventId(id);
      },
    }),
    [],
  );

  return (
    <PeekContext.Provider value={api}>
      {children}
      <DocSheet docId={docId} onClose={() => setDocId(null)} />
      <EventSheet eventId={eventId} onClose={() => setEventId(null)} />
    </PeekContext.Provider>
  );
}

export function usePeek(): PeekApi {
  const api = useContext(PeekContext);
  if (!api) throw new Error('usePeek must be used inside <PeekProvider>');
  return api;
}
