import { describe, it, expect } from "vitest";
import { resolveFirebaseCredential } from "./credentials";

describe("resolveFirebaseCredential", () => {
  it("uses the service account JSON when provided (local dev, other hosts)", () => {
    const json = JSON.stringify({ project_id: "p", client_email: "e@p.iam.gserviceaccount.com", private_key: "k" });
    expect(resolveFirebaseCredential({ FIREBASE_SERVICE_ACCOUNT: json })).toEqual({
      kind: "service-account",
      serviceAccount: { project_id: "p", client_email: "e@p.iam.gserviceaccount.com", private_key: "k" },
    });
  });

  it("falls back to Application Default Credentials (Cloud Run service identity) when absent", () => {
    expect(resolveFirebaseCredential({})).toEqual({ kind: "application-default" });
  });

  it("treats an empty value as absent", () => {
    expect(resolveFirebaseCredential({ FIREBASE_SERVICE_ACCOUNT: "  " })).toEqual({ kind: "application-default" });
  });

  it("fails clearly on malformed JSON instead of silently using another identity", () => {
    expect(() => resolveFirebaseCredential({ FIREBASE_SERVICE_ACCOUNT: "{not json" })).toThrow(/FIREBASE_SERVICE_ACCOUNT/);
  });
});
