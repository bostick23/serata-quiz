import { describe, it, expect } from "vitest";
import { retryDelayMs, MAX_JOIN_ATTEMPTS } from "./retry";

describe("retryDelayMs", () => {
  it("backs off exponentially from one second", () => {
    expect([0, 1, 2].map(retryDelayMs)).toEqual([1_000, 2_000, 4_000]);
  });

  it("is capped so retries keep happening during a long outage", () => {
    expect(retryDelayMs(10)).toBe(8_000);
  });
});

describe("MAX_JOIN_ATTEMPTS", () => {
  it("gives up within about half a minute so the user can act", () => {
    const totalWait = Array.from({ length: MAX_JOIN_ATTEMPTS - 1 }, (_, i) => retryDelayMs(i)).reduce((a, b) => a + b, 0);
    expect(totalWait).toBeLessThanOrEqual(30_000);
    expect(MAX_JOIN_ATTEMPTS).toBeGreaterThanOrEqual(4);
  });
});
