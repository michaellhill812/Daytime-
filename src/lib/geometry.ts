/** SVG polar helpers. Angles are degrees, 0° pointing right, increasing clockwise. */

export interface Point {
  x: number;
  y: number;
}

export function polar(cx: number, cy: number, r: number, deg: number): Point {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/** A stroked arc. Sweeps clockwise from `startDeg` to `endDeg`. */
export function arcPath(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
): string {
  const sweep = endDeg - startDeg;
  // A full circle can't be expressed as a single arc — nudge it just short.
  const end = Math.abs(sweep) >= 360 ? startDeg + 359.99 * Math.sign(sweep) : endDeg;

  const p1 = polar(cx, cy, r, startDeg);
  const p2 = polar(cx, cy, r, end);
  const largeArc = Math.abs(end - startDeg) > 180 ? 1 : 0;
  const sweepFlag = end > startDeg ? 1 : 0;

  return `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} ${sweepFlag} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
}

/** A filled pie wedge from the center out to `r` — used as a generous tap target. */
export function wedgePath(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
): string {
  const p1 = polar(cx, cy, r, startDeg);
  const p2 = polar(cx, cy, r, endDeg);
  const largeArc = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;

  return `M ${cx} ${cy} L ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)} Z`;
}

/**
 * Where each domain sits on the rim. The first domain points straight up, and
 * the rest are spaced evenly clockwise, so the layout is a pure function of how
 * many domains exist.
 */
export function spokeAngles(count: number): number[] {
  if (count === 0) return [];
  const step = 360 / count;
  return Array.from({ length: count }, (_, i) => -90 + i * step);
}

/** Text anchoring that keeps labels reading outward from the hub. */
export function labelAnchor(deg: number): 'start' | 'middle' | 'end' {
  const norm = ((deg % 360) + 360) % 360;
  if (norm > 100 && norm < 260) return 'end';
  if (norm < 80 || norm > 280) return 'start';
  return 'middle';
}
