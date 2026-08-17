import { useCallback, useEffect, useState } from 'react';
import WheelView from './views/WheelView';
import WallView from './views/WallView';
import WorldView from './views/WorldView';
import SpinCue from './components/SpinCue';
import ViewRail from './components/ViewRail';
import FirstRunHint from './components/FirstRunHint';
import { PeekProvider } from './components/PeekProvider';
import { useNavGestures } from './hooks/useNavGestures';
import type { ViewId } from './types';

/**
 * The shell owns navigation only.
 *
 * Wheel and Wall are two faces of one base layer; World rides above both as an
 * overlay, so swiping it away returns you to whichever face you left. That is
 * what makes every view reachable from every other view with a single gesture.
 */
export default function App() {
  const [base, setBase] = useState<'wheel' | 'wall'>('wheel');
  const [worldOpen, setWorldOpen] = useState(false);

  const current: ViewId = worldOpen ? 'world' : base;

  const goWall = useCallback(() => {
    setBase('wall');
    setWorldOpen(false);
  }, []);

  const goWheel = useCallback(() => {
    setBase('wheel');
    setWorldOpen(false);
  }, []);

  const openWorld = useCallback(() => setWorldOpen(true), []);
  const closeWorld = useCallback(() => setWorldOpen(false), []);

  const { bind, spinProgress } = useNavGestures({
    onTapBackground: goWall,
    onSpin: goWheel,
    onSwipeUp: openWorld,
    onSwipeDown: closeWorld,
  });

  const goTo = useCallback(
    (view: ViewId) => {
      if (view === 'world') openWorld();
      else if (view === 'wall') goWall();
      else goWheel();
    },
    [goWall, goWheel, openWorld],
  );

  // Desktop deserves keys as well as gestures: 1/2/3, and Escape to back out.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return;

      if (e.key === '1') goWheel();
      else if (e.key === '2') goWall();
      else if (e.key === '3') openWorld();
      else if (e.key === 'Escape' && worldOpen) closeWorld();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeWorld, goWheel, goWall, openWorld, worldOpen]);

  return (
    <div className="app" {...bind}>
      <div className="app__aurora" aria-hidden />

      <PeekProvider>
        <div className="stage">
          <WheelView active={base === 'wheel' && !worldOpen} />
          <WallView active={base === 'wall' && !worldOpen} />
        </div>

        <WorldView open={worldOpen} onClose={closeWorld} />
      </PeekProvider>

      <SpinCue progress={spinProgress} />
      <ViewRail current={current} onNavigate={goTo} />
      <FirstRunHint />
    </div>
  );
}
