/**
 * Feedback for the spin gesture: an arc that closes as you turn. Without it,
 * a half-turn of dragging feels like nothing is happening until it suddenly is.
 */
export default function SpinCue({ progress }: { progress: number }) {
  if (progress <= 0.02) return null;

  const r = 46;
  const circumference = 2 * Math.PI * r;

  return (
    <div className="spin-cue" aria-hidden style={{ opacity: 0.25 + progress * 0.75 }}>
      <svg viewBox="0 0 120 120" width="120" height="120">
        <circle cx="60" cy="60" r={r} className="spin-cue__track" />
        <circle
          cx="60"
          cy="60"
          r={r}
          className="spin-cue__fill"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          transform="rotate(-90 60 60)"
        />
      </svg>
      <span className="spin-cue__label">{progress >= 1 ? 'Wheel' : 'Keep turning'}</span>
    </div>
  );
}
