import { describe, it, expect } from "vitest";
import { createTtlCache } from "./ttl-cache";
import { pickQuestions } from "./pick-questions";
import { startOfDayInTimeZone } from "./time";

describe("createTtlCache", () => {
  it("loads once and serves from memory within the TTL", async () => {
    let now = 0;
    let loads = 0;
    const cache = createTtlCache(async (key: string) => `${key}-${++loads}`, 1_000, () => now);

    expect(await cache.get("it")).toBe("it-1");
    now = 999;
    expect(await cache.get("it")).toBe("it-1");
    expect(loads).toBe(1);
  });

  it("reloads after the TTL expires", async () => {
    let now = 0;
    let loads = 0;
    const cache = createTtlCache(async () => ++loads, 1_000, () => now);
    await cache.get("it");
    now = 1_001;

    expect(await cache.get("it")).toBe(2);
  });

  it("shares a single load between concurrent callers", async () => {
    let loads = 0;
    const cache = createTtlCache(async () => {
      loads++;
      await new Promise(r => setTimeout(r, 10));
      return loads;
    }, 1_000);

    const [a, b] = await Promise.all([cache.get("it"), cache.get("it")]);

    expect(a).toBe(1);
    expect(b).toBe(1);
    expect(loads).toBe(1);
  });

  it("reloads after invalidate()", async () => {
    let loads = 0;
    const cache = createTtlCache(async () => ++loads, 60_000);
    await cache.get("it");

    cache.invalidate();

    expect(await cache.get("it")).toBe(2);
  });

  it("does not cache a failed load", async () => {
    let calls = 0;
    const cache = createTtlCache(async () => {
      calls++;
      if (calls === 1) throw new Error("down");
      return "ok";
    }, 60_000);

    await expect(cache.get("it")).rejects.toThrow("down");
    expect(await cache.get("it")).toBe("ok");
  });
});

describe("pickQuestions", () => {
  const bank = [
    { id: "a1", category: "Arte" },
    { id: "a2", category: "Arte" },
    { id: "a3", category: "Arte" },
    { id: "s1", category: "Storia" },
    { id: "s2", category: "Storia" },
    { id: "g1", category: "Geografia" },
  ];
  const noShuffle = <T,>(arr: T[]) => [...arr];

  it("respects the per-category limit", () => {
    const result = pickQuestions(bank, { numQuestions: 4, maxPerCategory: 1 }, noShuffle);
    expect(result).toMatchObject({ ok: false, reason: "category-limit", selectable: 3 });
  });

  it("picks the requested number of questions", () => {
    const result = pickQuestions(bank, { numQuestions: 4, maxPerCategory: 2 }, noShuffle);
    expect(result.ok && result.questions.map(q => q.id)).toEqual(["a1", "a2", "s1", "s2"]);
  });

  it("filters by category and excludes already used questions", () => {
    const result = pickQuestions(
      bank,
      { numQuestions: 2, maxPerCategory: 5, categories: ["Arte"], excludeIds: new Set(["a1"]) },
      noShuffle,
    );
    expect(result.ok && result.questions.map(q => q.id)).toEqual(["a2", "a3"]);
  });

  it("reports how many questions are available when there are not enough", () => {
    const result = pickQuestions(bank, { numQuestions: 10, maxPerCategory: 10 }, noShuffle);
    expect(result).toMatchObject({ ok: false, reason: "not-enough", available: 6 });
  });
});

describe("startOfDayInTimeZone", () => {
  it("returns Rome midnight in winter (UTC+1)", () => {
    const start = startOfDayInTimeZone(new Date("2026-01-15T10:00:00Z"), "Europe/Rome");
    expect(start.toISOString()).toBe("2026-01-14T23:00:00.000Z");
  });

  it("returns Rome midnight in summer (UTC+2)", () => {
    const start = startOfDayInTimeZone(new Date("2026-07-15T10:00:00Z"), "Europe/Rome");
    expect(start.toISOString()).toBe("2026-07-14T22:00:00.000Z");
  });

  it("uses the Rome date, not the UTC date, just after Rome midnight", () => {
    // 23:30 UTC on Jan 15 is already Jan 16 in Rome
    const start = startOfDayInTimeZone(new Date("2026-01-15T23:30:00Z"), "Europe/Rome");
    expect(start.toISOString()).toBe("2026-01-15T23:00:00.000Z");
  });

  it("handles the day daylight saving time starts", () => {
    // 2026-03-29: clocks go from 02:00 CET to 03:00 CEST; midnight was still UTC+1
    const start = startOfDayInTimeZone(new Date("2026-03-29T12:00:00Z"), "Europe/Rome");
    expect(start.toISOString()).toBe("2026-03-28T23:00:00.000Z");
  });
});
