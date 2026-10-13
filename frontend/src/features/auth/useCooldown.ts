import { useCallback, useEffect, useState } from 'react';

/** Counts down once per second from `start(seconds)`. */
export function useCooldown(): { remaining: number; start: (seconds: number) => void } {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    if (remaining <= 0) return;
    const id = window.setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => window.clearTimeout(id);
  }, [remaining]);
  const start = useCallback((seconds: number) => setRemaining(seconds), []);
  return { remaining, start };
}
