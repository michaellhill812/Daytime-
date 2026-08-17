import { useState } from 'react';

const KEY = 'daytime.hint.dismissed';

function alreadySeen(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Gestures with no chrome are only elegant if you know them. Shown once,
 * dismissed forever.
 */
export default function FirstRunHint() {
  const [dismissed, setDismissed] = useState(alreadySeen);

  const dismiss = () => {
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* nothing worth failing over */
    }
    setDismissed(true);
  };

  if (dismissed) return null;

  return (
    <div className="hint" data-gesture="block">
      <div className="hint__card">
        <h2 className="hint__title">Three views, three gestures.</h2>
        <ul className="hint__list">
          <li>
            <span className="hint__key">Tap</span> the space around the wheel for the{' '}
            <strong>Wall</strong>
          </li>
          <li>
            <span className="hint__key">Turn</span> — drag in a circle — for the{' '}
            <strong>Wheel</strong>
          </li>
          <li>
            <span className="hint__key">Swipe up</span> from anywhere for <strong>World</strong>
          </li>
        </ul>
        <button type="button" className="hint__go" onClick={dismiss}>
          Begin
        </button>
      </div>
    </div>
  );
}
