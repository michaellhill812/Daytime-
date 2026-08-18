import type { ViewId } from '../types';

const VIEWS: { id: ViewId; label: string; key: string }[] = [
  { id: 'wheel', label: 'Wheel', key: '1' },
  { id: 'wall', label: 'Wall', key: '2' },
  { id: 'world', label: 'World', key: '3' },
];

/**
 * The only way to move between views. Full width and split into three equal
 * targets so it can be hit without looking, but quiet enough to read as an edge
 * of the screen rather than a toolbar sitting on top of the content.
 */
export default function ViewRail({
  current,
  onNavigate,
}: {
  current: ViewId;
  onNavigate: (view: ViewId) => void;
}) {
  return (
    <nav className="rail" aria-label="Views">
      {VIEWS.map((v) => (
        <button
          key={v.id}
          type="button"
          className={`rail__tab${current === v.id ? ' is-current' : ''}`}
          aria-current={current === v.id ? 'page' : undefined}
          title={`${v.label} (${v.key})`}
          onClick={() => onNavigate(v.id)}
        >
          <span className="rail__mark" aria-hidden />
          <span className="rail__label">{v.label}</span>
        </button>
      ))}
    </nav>
  );
}
