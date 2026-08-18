import { useCallback, useEffect, useState } from 'react';
import WheelView from './views/WheelView';
import WallView from './views/WallView';
import WorldView from './views/WorldView';
import ViewRail from './components/ViewRail';
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
      </PeekProvider>

      <ViewRail current={current} onNavigate={goTo} />
    </div>
  );
}
