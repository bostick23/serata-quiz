/** Whole seconds shown on a countdown towards `deadline` (local clock, ms). */
export function secondsLeft(deadline: number | null, now: number): number {
  if (!deadline) return 0;
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

/**
 * Delay until the displayed second changes (plus a small margin), so the UI
 * re-renders once per second instead of on a fixed fast interval.
 * Returns null when the countdown is over.
 */
export function msUntilNextTick(deadline: number, now: number): number | null {
  const remaining = deadline - now;
  if (remaining <= 0) return null;
  return (remaining % 1000 || 1000) + 10;
}
