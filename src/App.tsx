import { useCallback, useEffect, useState } from 'react';
import WheelView from './views/WheelView';
import WallView from './views/WallView';
import WorldView from './views/WorldView';
import ViewRail from './components/ViewRail';
import UpdatesBell from './components/UpdatesBell';
import Messages from './components/Messages';

/**
 * The field guide — what the three views are for, and how to put the app on a
 * phone. Published separately rather than built in: it explains the app from
 * outside it, and someone who cannot get signed in still needs to be able to
 * read it.
 */
const GUIDE_URL = 'https://claude.ai/code/artifact/d645ba04-afed-4048-b451-7d62c864d52d';
import { PeekProvider } from './components/PeekProvider';
import type { ViewId } from './types';

/**
 * The shell owns navigation only.
 *
 * Wheel and Wall are two faces of one base layer; World rides above both as an
 * overlay, so leaving it returns you to whichever face you left. Navigation is
 * the bottom bar — plus 1/2/3 on a keyboard.
 */
export default function App() {
  const [base, setBase] = useState<'wheel' | 'wall'>('wheel');
  const [worldOpen, setWorldOpen] = useState(false);

  const current: ViewId = worldOpen ? 'world' : base;

  const goTo = useCallback((view: ViewId) => {
    if (view === 'world') {
      setWorldOpen(true);
      return;
    }
    setBase(view);
    setWorldOpen(false);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

      if (e.key === '1') goTo('wheel');
      else if (e.key === '2') goTo('wall');
      else if (e.key === '3') goTo('world');
      else if (e.key === 'Escape' && worldOpen) setWorldOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goTo, worldOpen]);

  return (
    <div className="app">
      <div className="app__aurora" aria-hidden />

      <PeekProvider>
        <div className="stage">
          <WheelView active={base === 'wheel' && !worldOpen} />
          <WallView active={base === 'wall' && !worldOpen} />
        </div>

        <WorldView open={worldOpen} onClose={() => setWorldOpen(false)} />

        {/* Inside the provider: opening an item from the feed uses the same
            peek sheets every other view does.

            Order is left-to-right, so the bell ends up nearest the account
            button and the guide sits furthest out — the one that never
            changes is the one you never need to find in a hurry. */}
        <div className="hud">
          <a
            className="info"
            href={GUIDE_URL}
            target="_blank"
            rel="noreferrer"
            title="How Daytime works"
            aria-label="How Daytime works"
          >
            <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden>
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" fill="none" />
              <circle cx="12" cy="7.6" r="1.15" fill="currentColor" />
              <path
                d="M12 10.8v6"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          </a>
          <Messages />
          <UpdatesBell />
        </div>
      </PeekProvider>

      <ViewRail current={current} onNavigate={goTo} />
    </div>
  );
}
