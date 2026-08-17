import { useMemo } from 'react';
import type { RingSegment } from '../store/selectors';
import { arcPath, labelAnchor, polar, spokeAngles, wedgePath } from '../lib/geometry';

/**
 * Labels live outside the rim. Placing them along the spoke put horizontal text
 * across horizontal lines, which read as strikethrough; outside the ring, no
 * label can ever cross a spoke.
 */
const SIZE = 520;
const C = SIZE / 2;
const RING_R = 168;
const HIT_R = 176;
const SPOKE_INNER = 78;
const SPOKE_OUTER = 150;
const LABEL_R = 186;
const HUB_R = 64;
const GAP_DEG = 5; // breathing room between ring segments

interface WheelProps {
  segments: RingSegment[];
  focusCount: number;
  onSelectDomain: (domainId: string) => void;
  onSelectCenter: () => void;
}

/**
 * The home visualization: a hub carrying today's load, one spoke per domain,
 * and a rim that reads priority as hue and completion as fill.
 *
 * Everything is derived from `segments.length`, so adding or removing a domain
 * re-lays the wheel out with no other change.
 */
export default function Wheel({
  segments,
  focusCount,
  onSelectDomain,
  onSelectCenter,
}: WheelProps) {
  const angles = useMemo(() => spokeAngles(segments.length), [segments.length]);
  const span = segments.length > 0 ? 360 / segments.length : 360;

  return (
    <svg
      className="wheel"
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="group"
      aria-label="Task domains"
      data-gesture="opaque"
    >
      <defs>
        <radialGradient id="hubGlow" cx="50%" cy="42%" r="65%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.10)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        <filter id="softGlow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Continuous hairline so the rim still reads as a ring when domains are quiet */}
      <circle cx={C} cy={C} r={RING_R} className="wheel__rim" />

      {segments.map((seg, i) => {
        const angle = angles[i] ?? -90;
        const start = angle - span / 2 + GAP_DEG / 2;
        const end = angle + span / 2 - GAP_DEG / 2;

        // Fill grows outward from the spoke rather than from the sector's edge,
        // so a part-finished arc is unmistakably attached to its own domain.
        const reach = ((end - start) / 2) * seg.completion;

        const inner = polar(C, C, SPOKE_INNER, angle);
        const outer = polar(C, C, SPOKE_OUTER, angle);
        const label = polar(C, C, LABEL_R, angle);
        const anchor = labelAnchor(angle);

        // On upward spokes the label stacks away from the hub, so the name stays
        // outermost and the count never lands on the rim.
        const pointsUp = Math.sin((angle * Math.PI) / 180) < -0.3;
        const nameY = pointsUp ? label.y - 9 : label.y;
        const countY = pointsUp ? label.y + 6 : label.y + 15;

        return (
          <g key={seg.domain.id} className="spoke">
            {/* Whole sector is tappable — the visible spoke is far too thin to aim at */}
            <path
              d={wedgePath(C, C, HIT_R, start, end)}
              className="spoke__hit"
              role="button"
              tabIndex={0}
              aria-label={`${seg.domain.name}: ${seg.openCount} open, ${seg.done} of ${seg.total} done`}
              onClick={() => onSelectDomain(seg.domain.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectDomain(seg.domain.id);
                }
              }}
            />

            <path d={arcPath(C, C, RING_R, start, end)} className="wheel__track" />

            {seg.completion > 0.001 && (
              <path
                d={arcPath(C, C, RING_R, angle - reach, angle + reach)}
                className="wheel__fill"
                stroke={seg.color}
                filter="url(#softGlow)"
              />
            )}

            <line
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              className="spoke__line"
              stroke={seg.domain.accent}
            />
            {/* The cap doubles as the overdue flag: one dot, two meanings, no extra clutter */}
            <circle
              cx={outer.x}
              cy={outer.y}
              r={seg.overdueCount > 0 ? 4.5 : seg.openCount > 0 ? 4 : 3}
              className={`spoke__cap${seg.overdueCount > 0 ? ' spoke__cap--late' : ''}`}
              fill={
                seg.overdueCount > 0
                  ? '#ff453a'
                  : seg.openCount > 0
                    ? seg.domain.accent
                    : 'rgba(255,255,255,0.25)'
              }
            />

            <text
              x={label.x}
              y={nameY}
              className="spoke__label"
              textAnchor={anchor}
              dominantBaseline="middle"
            >
              {seg.domain.name}
            </text>
            <text
              x={label.x}
              y={countY}
              className="spoke__count"
              textAnchor={anchor}
              dominantBaseline="middle"
            >
              {seg.openCount === 0 ? 'clear' : `${seg.openCount} open`}
            </text>

          </g>
        );
      })}

      {/* Hub — the day's whole mental load in one number */}
      <g
        className="hub"
        role="button"
        tabIndex={0}
        aria-label={`${focusCount} things need you today`}
        onClick={onSelectCenter}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelectCenter();
          }
        }}
      >
        <circle cx={C} cy={C} r={HUB_R} className="hub__disc" />
        <circle cx={C} cy={C} r={HUB_R} fill="url(#hubGlow)" />
        <circle cx={C} cy={C} r={HUB_R} className="hub__edge" />
        <text x={C} y={C - 6} className="hub__count" textAnchor="middle" dominantBaseline="middle">
          {focusCount}
        </text>
        <text x={C} y={C + 24} className="hub__word" textAnchor="middle" dominantBaseline="middle">
          {focusCount === 0 ? 'Clear' : 'Today'}
        </text>
      </g>
    </svg>
  );
}
