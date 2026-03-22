const MAX_POINTS = 200;
const MIN_POINTS = 50;
const ANSWER_TIME_MS = 10000;

export function calculateScore(
  isCorrect: boolean,
  elapsedMs: number
): number {
  const clampedElapsed = Math.max(0, Math.min(elapsedMs, ANSWER_TIME_MS));
  const timeFraction = clampedElapsed / ANSWER_TIME_MS;
  const points = Math.round(MAX_POINTS - (MAX_POINTS - MIN_POINTS) * timeFraction);

  return isCorrect ? points : -points;
}
