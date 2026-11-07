import { describe, it, expect } from "vitest";
import { joinPayloadSchema, answerPayloadSchema, joinCodePayloadSchema, MAX_PHOTO_LENGTH } from "./schemas";

describe("joinPayloadSchema", () => {
  it("normalizes the team name and join code", () => {
    const parsed = joinPayloadSchema.parse({ joinCode: " abc234 ", teamName: "  I   Pirati " });
    expect(parsed).toMatchObject({ joinCode: "ABC234", teamName: "I Pirati" });
  });

  it("rejects an empty team name", () => {
    expect(joinPayloadSchema.safeParse({ joinCode: "ABC234", teamName: "   " }).success).toBe(false);
  });

  it("rejects a team name longer than 50 characters", () => {
    expect(joinPayloadSchema.safeParse({ joinCode: "ABC234", teamName: "x".repeat(51) }).success).toBe(false);
  });

  it("accepts a small base64 JPEG photo", () => {
    const photoUrl = "data:image/jpeg;base64," + "A".repeat(1000);
    expect(joinPayloadSchema.safeParse({ joinCode: "ABC234", teamName: "A", photoUrl }).success).toBe(true);
  });

  it("rejects an oversized photo", () => {
    const photoUrl = "data:image/jpeg;base64," + "A".repeat(MAX_PHOTO_LENGTH);
    expect(joinPayloadSchema.safeParse({ joinCode: "ABC234", teamName: "A", photoUrl }).success).toBe(false);
  });

  it("rejects a photo that is not an image data URL", () => {
    const photoUrl = "javascript:alert(1)";
    expect(joinPayloadSchema.safeParse({ joinCode: "ABC234", teamName: "A", photoUrl }).success).toBe(false);
  });
});

describe("answerPayloadSchema", () => {
  it("rejects a non-integer choice", () => {
    expect(answerPayloadSchema.safeParse({ joinCode: "ABC234", gameQuestionId: "gq1", chosenIndex: 1.5 }).success).toBe(false);
  });

  it("rejects a string choice", () => {
    expect(answerPayloadSchema.safeParse({ joinCode: "ABC234", gameQuestionId: "gq1", chosenIndex: "1" }).success).toBe(false);
  });

  it("accepts a valid answer", () => {
    expect(answerPayloadSchema.safeParse({ joinCode: "ABC234", gameQuestionId: "gq1", chosenIndex: 2 }).success).toBe(true);
  });
});

describe("joinCodePayloadSchema", () => {
  it("rejects a missing join code", () => {
    expect(joinCodePayloadSchema.safeParse({}).success).toBe(false);
  });

  it("rejects a non-object payload", () => {
    expect(joinCodePayloadSchema.safeParse("ABC234").success).toBe(false);
  });
});
