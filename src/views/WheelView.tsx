import { useMemo, useState } from 'react';
import Wheel from '../components/Wheel';
import FocusSheet from '../components/FocusSheet';
import DomainSheet from '../components/DomainSheet';
import { useDaytimeState } from '../store/context';
import { focusDigest, ringSegments } from '../store/selectors';
import { useNow } from '../hooks/useNow';

/**
 * Home. Deliberately bare: the wheel is the entire screen, and everything else
 * arrives as a sheet on top of it.
 */
export default function WheelView({ active }: { active: boolean }) {
  const state = useDaytimeState();
  const now = useNow();

  const [focusOpen, setFocusOpen] = useState(false);
  const [domainId, setDomainId] = useState<string | null>(null);

  const segments = useMemo(() => ringSegments(state, now), [state, now]);
  const digest = useMemo(() => focusDigest(state, now), [state, now]);

  return (
    <div className={`view view--wheel${active ? ' is-active' : ''}`} aria-hidden={!active}>
      <div className="wheel-stage">
        <Wheel
          segments={segments}
          focusCount={digest.count}
          focusPriority={digest.topPriority}
          onSelectDomain={setDomainId}
          onSelectCenter={() => setFocusOpen(true)}
        />
      </div>

      {active && (
        <>
          <FocusSheet
            open={focusOpen}
            onClose={() => setFocusOpen(false)}
            digest={digest}
            now={now}
          />
          <DomainSheet domainId={domainId} onClose={() => setDomainId(null)} now={now} />
        </>
      )}
    </div>
  );
}
