import { useMemo } from 'react';
import { PRIORITY_COLOR, type RingSegment } from '../store/selectors';
import type { Priority } from '../types';
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

/**
 * The lit arc, widest and faintest first. Three concentric strokes read as a
 * bloom around the core without a blur filter — and unlike a filter, they
 * follow the rim's curve exactly, because they are the same arc.
 */
const FILL_LAYERS = [
  { width: 15, opacity: 0.12 },
  { width: 11.5, opacity: 0.24 },
  { width: 9, opacity: 1 },
];

interface WheelProps {
  segments: RingSegment[];
  focusCount: number;
  /** Hottest priority the hub's number stands for, or null when the day is clear. */
  focusPriority: Priority | null;
  onSelectDomain: (domainId: string) => void;
  onSelectCenter: () => void;
}

/**
 * The home visualization: a hub carrying today's load, one spoke per domain,
 * and a rim that reads priority as hue and open work as fill.
 *
 * Everything is derived from `segments.length`, so adding or removing a domain
 * re-lays the wheel out with no other change.
 */
export default function Wheel({
  segments,
  focusCount,
  focusPriority,
  onSelectDomain,
  onSelectCenter,
}: WheelProps) {
  const angles = useMemo(() => spokeAngles(segments.length), [segments.length]);
  const span = segments.length > 0 ? 360 / segments.length : 360;

  return (
    <svg className="wheel" viewBox={`0 0 ${SIZE} ${SIZE}`} role="group" aria-label="Task domains">
      <defs>
        {/* Glass, built entirely out of gradients.

            The convincing part of a frosted panel is not the blur — it is the
            light on it: a sheen down the face, a specular near the top, and a
            rim that catches hardest where the light hits. Those are paint, and
            paint is free after the first frame. A blur is not: the last one in
            this app held the whole thing at ~14fps.

            Stops use stopColor + stopOpacity rather than rgba(), which is the
            portable spelling for SVG gradients. */}
        <radialGradient id="hubGlow" cx="50%" cy="42%" r="65%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.10)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>

        {/* Sheen down the face of the disc, brightest at the top where the
            spotlight lands, with a faint bounce along the bottom edge. */}
        <linearGradient
          id="hubGlass"
          gradientUnits="userSpaceOnUse"
          x1={C}
          y1={C - HUB_R}
          x2={C}
          y2={C + HUB_R}
        >
          <stop offset="0%" stopColor="#fff" stopOpacity="0.11" />
          <stop offset="46%" stopColor="#fff" stopOpacity="0.015" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0.05" />
        </linearGradient>

        {/* The highlight itself — small, high, and gone by halfway down. */}
        <radialGradient id="hubSpec" cx="50%" cy="6%" r="58%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.15" />
          <stop offset="55%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>

        {/* Rim light. Bright along the top arc, dimmer at the sides, picking
            up again underneath — the way a real edge catches a room. */}
        <linearGradient
          id="hubRim"
          gradientUnits="userSpaceOnUse"
          x1={C}
          y1={C - HUB_R}
          x2={C}
          y2={C + HUB_R}
        >
          <stop offset="0%" stopColor="#fff" stopOpacity="0.4" />
          <stop offset="50%" stopColor="#fff" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0.22" />
        </linearGradient>

        {/* One light source for the whole ring. userSpaceOnUse matters here:
            per-segment bounding boxes would each restart the gradient, so every
            arc would be lit from its own top and the ring would read as flat. */}
        <linearGradient
          id="ringLight"
          gradientUnits="userSpaceOnUse"
          x1={C}
          y1={C - RING_R}
          x2={C}
          y2={C + RING_R}
        >
          <stop offset="0%" stopColor="#fff" stopOpacity="0.2" />
          <stop offset="55%" stopColor="#fff" stopOpacity="0.055" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0.11" />
        </linearGradient>
      </defs>

      {/* Continuous hairline so the rim still reads as a ring when domains are quiet */}
      <circle cx={C} cy={C} r={RING_R} className="wheel__rim" stroke="url(#ringLight)" />

      {segments.map((seg, i) => {
        const angle = angles[i] ?? -90;
        const start = angle - span / 2 + GAP_DEG / 2;
        const end = angle + span / 2 - GAP_DEG / 2;

        // Fill grows outward from the spoke rather than from the sector's edge,
        // so a part-filled arc is unmistakably attached to its own domain.
        const reach = ((end - start) / 2) * seg.load;

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

            <path
              d={arcPath(C, C, RING_R, start, end)}
              className="wheel__track"
              stroke="url(#ringLight)"
            />

            {/* The glow is drawn as wider copies of the same arc rather than a
                blur filter. A filter's region is measured from the path's
                bounding box, and an arc near the top of the circle is almost
                flat — so the box was a sliver, and the blur got clipped into a
                rectangle sitting visibly across the curve. Concentric strokes
                can only ever be the shape of the arc itself. */}
            {seg.load > 0 &&
              FILL_LAYERS.map((layer) => (
                <path
                  key={layer.width}
                  d={arcPath(C, C, RING_R, angle - reach, angle + reach)}
                  className="wheel__fill"
                  stroke={seg.color}
                  strokeWidth={layer.width}
                  opacity={layer.opacity}
                />
              ))}

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

            {/* The label sits outside the tap wedge, so it carries its own target —
                tapping a domain's name should open that domain, not fall through. */}
            <g
              className="spoke__labels"
              role="button"
              tabIndex={0}
              aria-label={`${seg.domain.name} details`}
              onClick={() => onSelectDomain(seg.domain.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectDomain(seg.domain.id);
                }
              }}
            >
              <text
                x={label.x}
                y={nameY}
                className="spoke__label"
                textAnchor={anchor}
                dominantBaseline="middle"
              >
                {seg.domain.name}
              </text>
              {/* "clear" is a task-count word; a domain that is a procedure and
                  holds no tasks says nothing rather than something meaningless. */}
              {!(seg.domain.guideDocId && seg.total === 0) && (
                <text
                  x={label.x}
                  y={countY}
                  className="spoke__count"
                  textAnchor={anchor}
                  dominantBaseline="middle"
                >
                  {seg.openCount === 0 ? 'clear' : `${seg.openCount} open`}
                </text>
              )}
            </g>
          </g>
        );
      })}

      {/* Hub — the day's whole mental load in one number */}
      <g
        className="hub"
        role="button"
        tabIndex={0}
        aria-label={
          focusCount === 0
            ? 'Nothing on deck today'
            : `${focusCount} ${focusCount === 1 ? 'item is' : 'items are'} on deck today`
        }
        onClick={onSelectCenter}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelectCenter();
          }
        }}
      >
        <circle cx={C} cy={C} r={HUB_R} className="hub__disc" />
        <circle cx={C} cy={C} r={HUB_R} fill="url(#hubGlass)" />
        <circle cx={C} cy={C} r={HUB_R} fill="url(#hubSpec)" />
        <circle cx={C} cy={C} r={HUB_R} fill="url(#hubGlow)" />
        <circle cx={C} cy={C} r={HUB_R} className="hub__edge" stroke="url(#hubRim)" />
        {/* The colour rides a custom property rather than a `fill` attribute:
            .hub__count declares its own fill, and a CSS declaration beats an
            SVG presentation attribute every time. Clear days keep the neutral
            default, since no priority is standing behind the number. */}
        <text
          x={C}
          y={C - 6}
          className="hub__count"
          textAnchor="middle"
          dominantBaseline="middle"
          style={
            focusPriority === null
              ? undefined
              : ({ '--focus': PRIORITY_COLOR[focusPriority] } as React.CSSProperties)
          }
        >
          {focusCount}
        </text>
        <text x={C} y={C + 24} className="hub__word" textAnchor="middle" dominantBaseline="middle">
          {focusCount === 0 ? 'Clear' : 'Today'}
        </text>
      </g>
    </svg>
  );
}
