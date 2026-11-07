import { describe, it, expect } from "vitest";
import { parseTeamSession, teamSessionKey } from "./team-session";

describe("parseTeamSession", () => {
  it("returns the stored session", () => {
    const raw = JSON.stringify({ teamId: "t1", teamName: "A", rejoinToken: "tok" });
    expect(parseTeamSession(raw)).toEqual({ teamId: "t1", teamName: "A", rejoinToken: "tok" });
  });

  it("returns null for missing or corrupted data", () => {
    expect(parseTeamSession(null)).toBeNull();
    expect(parseTeamSession("{not json")).toBeNull();
    expect(parseTeamSession(JSON.stringify({ teamId: "t1" }))).toBeNull();
  });
});

describe("teamSessionKey", () => {
  it("is case-insensitive on the join code", () => {
    expect(teamSessionKey("abc234")).toBe(teamSessionKey("ABC234"));
  });
});
