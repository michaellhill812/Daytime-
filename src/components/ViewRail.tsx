import type { ViewId } from '../types';

const VIEWS: { id: ViewId; label: string }[] = [
  { id: 'wheel', label: 'Wheel' },
  { id: 'wall', label: 'Wall' },
  { id: 'world', label: 'World' },
];

/**
 * Three dots at the bottom edge. Gestures are the intended way to move around;
 * this exists so the app is never a guessing game — it says where you are, and
 * it works as a fallback on a trackpad where a spin is awkward.
 */
export default function ViewRail({
  current,
  onNavigate,
}: {
  current: ViewId;
  onNavigate: (view: ViewId) => void;
}) {
  return (
    <nav className="rail" data-gesture="block" aria-label="Views">
      {VIEWS.map((v) => (
        <button
          key={v.id}
          type="button"
          className={`rail__dot${current === v.id ? ' is-current' : ''}`}
          aria-label={v.label}
          aria-current={current === v.id}
          onClick={() => onNavigate(v.id)}
        >
          <span className="rail__mark" />
          <span className="rail__label">{v.label}</span>
        </button>
      ))}
    </nav>
  );
}
