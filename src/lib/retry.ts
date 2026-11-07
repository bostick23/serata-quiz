/** Attempts at (re)joining a game before the UI hands control back to the user. */
export const MAX_JOIN_ATTEMPTS = 5;

/** Exponential backoff (1s, 2s, 4s, …) capped at 8s. */
export function retryDelayMs(attempt: number): number {
  return Math.min(1_000 * 2 ** attempt, 8_000);
}
