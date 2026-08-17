import { useEffect, useState } from 'react';

/**
 * A clock that ticks on an interval, so "6:30pm" quietly becomes "2d overdue"
 * without a reload. Everything time-sensitive reads `now` from here rather than
 * calling `new Date()` mid-render, which keeps a single render consistent.
 */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    const onVisible = () => {
      if (document.visibilityState === 'visible') setNow(new Date());
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [intervalMs]);

  return now;
}
