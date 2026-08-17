import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

/**
 * The three navigation gestures, resolved from a single pointer stream so they
 * can never fight each other:
 *
 *   tap on the background   → Wall
 *   turn the screen like a dial → Wheel
 *   swipe up                → World   (swipe down goes back)
 *
 * One sequence produces at most one gesture. A spin fires the moment enough
 * angle has accumulated (so it feels like a dial that clicks over, not
 * something judged after you let go); tap and swipe are decided on release.
 *
 * Opting out: put `data-gesture="block"` on anything that owns its own pointer
 * handling (sheets, inputs, scrollers you never want to navigate from), or
 * `data-gesture="opaque"` on something that should absorb taps but still allow
 * spin and swipe to pass through it.
 */

const SPIN_THRESHOLD_DEG = 200; // roughly half a turn
const SPIN_MIN_RADIUS = 44; // ignore wobble near the pivot
const SWIPE_MIN_PX = 64;
const SWIPE_MAX_MS = 1000;
const SWIPE_AXIS_RATIO = 1.4; // vertical must clearly beat horizontal
const TAP_SLOP_PX = 12;
const TAP_MAX_MS = 500;

export interface NavGestureHandlers {
  onTapBackground?: () => void;
  onSpin?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  enabled?: boolean;
}

export interface NavGestureBinding {
  /** Spread onto the surface element. */
  bind: {
    onPointerDown: (e: ReactPointerEvent) => void;
    onPointerMove: (e: ReactPointerEvent) => void;
    onPointerUp: (e: ReactPointerEvent) => void;
    onPointerCancel: (e: ReactPointerEvent) => void;
  };
  /** 0..1 — how far through a spin the user currently is. Drives the visual cue. */
  spinProgress: number;
  /** Signed degrees turned so far this gesture, for rotating content under the finger. */
  spinAngle: number;
}

interface Sequence {
  pointerId: number;
  startX: number;
  startY: number;
  startTime: number;
  lastAngle: number;
  accumAngle: number;
  centerX: number;
  centerY: number;
  moved: number;
  /** Set once a gesture has fired, so the rest of the sequence is inert. */
  consumed: boolean;
  tappable: boolean;
  target: Element | null;
}

const angleAt = (x: number, y: number, cx: number, cy: number) =>
  (Math.atan2(y - cy, x - cx) * 180) / Math.PI;

/** Shortest signed difference between two angles, in degrees. */
function angleDelta(from: number, to: number): number {
  let d = to - from;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
}

function closestGestureRole(target: Element | null): string | null {
  const el = target?.closest?.('[data-gesture]');
  return el?.getAttribute('data-gesture') ?? null;
}

/**
 * True when some scrollable ancestor of `target` could still absorb a scroll in
 * this direction — in which case the user is scrolling content, not navigating.
 */
function scrollWouldConsume(target: Element | null, dy: number): boolean {
  let el: Element | null = target;
  while (el && el !== document.body) {
    const style = window.getComputedStyle(el);
    const scrolls = /(auto|scroll|overlay)/.test(style.overflowY);
    if (scrolls && el.scrollHeight > el.clientHeight + 1) {
      const atTop = el.scrollTop <= 0;
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
      // Swiping up (dy < 0) scrolls content downward.
      if (dy < 0 && !atBottom) return true;
      if (dy > 0 && !atTop) return true;
    }
    el = el.parentElement;
  }
  return false;
}

export function useNavGestures({
  onTapBackground,
  onSpin,
  onSwipeUp,
  onSwipeDown,
  enabled = true,
}: NavGestureHandlers): NavGestureBinding {
  const seq = useRef<Sequence | null>(null);
  const [spinAngle, setSpinAngle] = useState(0);

  const reset = useCallback(() => {
    seq.current = null;
    setSpinAngle(0);
  }, []);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      if (!enabled || !e.isPrimary) return;

      const target = e.target as Element;
      const role = closestGestureRole(target);
      if (role === 'block') return;

      // Deliberately no setPointerCapture here: capturing on the surface
      // retargets `click` to it, which would swallow every button and card tap
      // underneath.
      const rect = e.currentTarget.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      seq.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startTime: performance.now(),
        lastAngle: angleAt(e.clientX, e.clientY, centerX, centerY),
        accumAngle: 0,
        centerX,
        centerY,
        moved: 0,
        consumed: false,
        tappable: role !== 'opaque',
        target,
      };
    },
    [enabled],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent) => {
      const s = seq.current;
      if (!s || s.pointerId !== e.pointerId || s.consumed) return;

      const dx = e.clientX - s.startX;
      const dy = e.clientY - s.startY;
      s.moved = Math.max(s.moved, Math.hypot(dx, dy));

      const radius = Math.hypot(e.clientX - s.centerX, e.clientY - s.centerY);
      const angle = angleAt(e.clientX, e.clientY, s.centerX, s.centerY);

      if (radius >= SPIN_MIN_RADIUS) {
        s.accumAngle += angleDelta(s.lastAngle, angle);
      }
      s.lastAngle = angle;

      if (onSpin && Math.abs(s.accumAngle) >= SPIN_THRESHOLD_DEG) {
        s.consumed = true;
        reset();
        onSpin();
        return;
      }

      // Only surface the visual cue once the motion is unmistakably rotational,
      // so a plain drag doesn't make the screen wobble.
      setSpinAngle(Math.abs(s.accumAngle) > 25 ? s.accumAngle : 0);
    },
    [onSpin, reset],
  );

  const finish = useCallback(
    (e: ReactPointerEvent) => {
      const s = seq.current;
      if (!s || s.pointerId !== e.pointerId) return;
      const consumed = s.consumed;
      const { startX, startY, startTime, target, tappable, accumAngle, moved } = s;
      reset();
      if (consumed) return;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const dt = performance.now() - startTime;

      // A tap: barely moved, quickly released, on something that isn't claiming it.
      if (moved <= TAP_SLOP_PX && dt <= TAP_MAX_MS) {
        if (tappable) onTapBackground?.();
        return;
      }

      const isVertical = Math.abs(dy) > Math.abs(dx) * SWIPE_AXIS_RATIO;
      const fastEnough = dt <= SWIPE_MAX_MS;
      const notARotation = Math.abs(accumAngle) < 100;

      if (!isVertical || !fastEnough || !notARotation) return;
      if (scrollWouldConsume(target, dy)) return;

      if (dy <= -SWIPE_MIN_PX) onSwipeUp?.();
      else if (dy >= SWIPE_MIN_PX) onSwipeDown?.();
    },
    [onSwipeDown, onSwipeUp, onTapBackground, reset],
  );

  return {
    bind: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finish,
      onPointerCancel: reset as unknown as (e: ReactPointerEvent) => void,
    },
    spinProgress: Math.min(Math.abs(spinAngle) / SPIN_THRESHOLD_DEG, 1),
    spinAngle,
  };
}
