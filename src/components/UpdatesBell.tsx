import { useMemo, useState } from 'react';
import Sheet from './Sheet';
import { usePeek } from './PeekProvider';
import { useDaytimeState, useStore } from '../store/context';
import { recentChanges } from '../store/selectors';
import { formatShortDay, formatTime } from '../lib/date';

const SEEN_KEY = 'daytime.updates.seen';

/**
 * When this device last looked at the feed. Kept in localStorage rather than in
 * the shared document on purpose: "have I seen this" is a fact about a person
 * at a screen, and writing it into the workspace would mean your reading it
 * marked it read for Andrew too.
 */
function readSeen(): string {
  try {
    return window.localStorage.getItem(SEEN_KEY) ?? '';
  } catch {
    return '';
  }
}

function writeSeen(at: string): void {
  try {
    window.localStorage.setItem(SEEN_KEY, at);
  } catch {
    // Private browsing and full quotas both land here. The feed still works;
    // it just can't remember where you got to.
  }
}

const KIND_WORD = {
  doc: 'to the Wall',
  event: 'to the calendar',
  task: 'to the Wheel',
} as const;

/**
 * What the other person has been doing. Shows a count until you open it, then
 * keeps showing the same list without the count — the history stays readable
 * after it stops being news.
 */
export default function UpdatesBell() {
  const state = useDaytimeState();
  const store = useStore();
  const { openDoc, openEvent, openTask } = usePeek();

  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(readSeen);

  const changes = useMemo(
    () => recentChanges(state, store.actor, store.people),
    [state, store.actor, store.people],
  );
  const unseen = changes.filter((c) => c.at > seen);

  // Nothing to report and nothing to remember: in a workspace of one there is
  // never anybody else's work, so the bell stays out of the way entirely.
  if (changes.length === 0) return null;

  const markSeen = () => {
    const newest = changes[0]?.at;
    if (newest) {
      writeSeen(newest);
      setSeen(newest);
    }
  };

  return (
    <>
      <button
        type="button"
        className={`bell${unseen.length > 0 ? ' bell--live' : ''}`}
        aria-label={unseen.length > 0 ? `${unseen.length} new from someone else` : 'Recent changes'}
        onClick={() => {
          setOpen(true);
          markSeen();
        }}
      >
        <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden>
          <path
            d="M18 16v-5a6 6 0 10-12 0v5l-2 3h16zM10 19a2 2 0 004 0"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
        {unseen.length > 0 && <span className="bell__count">{unseen.length}</span>}
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="What's new"
        subtitle="Added by other people in this workspace"
      >
        <div className="list">
          {changes.map((c) => (
            <button
              key={`${c.kind}-${c.id}`}
              type="button"
              className={`agenda${c.at > seen ? ' agenda--fresh' : ''}`}
              onClick={() => {
                setOpen(false);
                if (c.kind === 'doc') openDoc(c.id);
                else if (c.kind === 'event') openEvent(c.id);
                else openTask(c.id);
              }}
            >
              {/* Day only in the column — adding the clock time wraps it onto
                  two lines on a phone and squeezes the title that matters. */}
              <span className="agenda__when" title={formatTime(new Date(c.at))}>
                {formatShortDay(new Date(c.at))}
              </span>
              <span className="agenda__title">{c.title}</span>
              <span className="agenda__where">
                {c.by} · {KIND_WORD[c.kind]}
              </span>
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
}
