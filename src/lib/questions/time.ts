/** Offset (ms) of `timeZone` from UTC at the given instant. */
function timeZoneOffset(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/** Instant of local midnight, in `timeZone`, of the day containing `date`. */
export function startOfDayInTimeZone(date: Date, timeZone: string): Date {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value);
  const localMidnightAsUtc = Date.UTC(get("year"), get("month") - 1, get("day"));

  // First guess with the current offset, then correct with the offset in force at midnight (DST days).
  const guess = localMidnightAsUtc - timeZoneOffset(date.getTime(), timeZone);
  return new Date(localMidnightAsUtc - timeZoneOffset(guess, timeZone));
}
