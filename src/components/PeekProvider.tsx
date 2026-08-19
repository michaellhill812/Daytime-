import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import DocSheet from './DocSheet';
import EventSheet from './EventSheet';
import TaskSheet from './TaskSheet';

interface PeekApi {
  /** Open a Wall document from anywhere — Wheel, Wall, or World. */
  openDoc: (id: string) => void;
  /** Open a World event from anywhere. */
  openEvent: (id: string) => void;
  /** Open a task from anywhere — it shows up in all three views. */
  openTask: (id: string) => void;
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
  const [taskId, setTaskId] = useState<string | null>(null);

  // Only one peek at a time: opening a second on top of the first stacks two
  // scrims and leaves Escape ambiguous about which it closes.
  const api = useMemo<PeekApi>(
    () => ({
      openDoc: (id) => {
        setEventId(null);
        setTaskId(null);
        setDocId(id);
      },
      openEvent: (id) => {
        setDocId(null);
        setTaskId(null);
        setEventId(id);
      },
      openTask: (id) => {
        setDocId(null);
        setEventId(null);
        setTaskId(id);
      },
    }),
    [],
  );

  return (
    <PeekContext.Provider value={api}>
      {children}
      <DocSheet docId={docId} onClose={() => setDocId(null)} />
      <EventSheet eventId={eventId} onClose={() => setEventId(null)} />
      <TaskSheet taskId={taskId} onClose={() => setTaskId(null)} />
    </PeekContext.Provider>
  );
}

export function usePeek(): PeekApi {
  const api = useContext(PeekContext);
  if (!api) throw new Error('usePeek must be used inside <PeekProvider>');
  return api;
}
