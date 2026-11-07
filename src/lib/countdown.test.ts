import { describe, it, expect } from "vitest";
import { secondsLeft, msUntilNextTick } from "./countdown";

describe("secondsLeft", () => {
  it("rounds up partial seconds", () => {
    expect(secondsLeft(10_000, 8_700)).toBe(2);
  });

  it("never goes below zero", () => {
    expect(secondsLeft(10_000, 12_000)).toBe(0);
  });

  it("is zero without a deadline", () => {
    expect(secondsLeft(null, 1_000)).toBe(0);
  });
});

describe("msUntilNextTick", () => {
  it("wakes up just after the displayed second changes", () => {
    // 2.3s left: the display shows 3 and must switch to 2 in 300ms
    const wait = msUntilNextTick(10_000, 7_700)!;
    expect(wait).toBeGreaterThanOrEqual(300);
    expect(wait).toBeLessThan(400);
    expect(secondsLeft(10_000, 7_700 + wait)).toBe(2);
  });

  it("waits a full second when exactly on a boundary", () => {
    const wait = msUntilNextTick(10_000, 8_000)!;
    expect(secondsLeft(10_000, 8_000 + wait)).toBe(1);
    expect(wait).toBeLessThan(1_100);
  });

  it("returns null once the deadline has passed", () => {
    expect(msUntilNextTick(10_000, 10_000)).toBeNull();
  });
});
