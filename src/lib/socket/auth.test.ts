import { describe, it, expect, beforeAll } from "vitest";
import { encode } from "next-auth/jwt";
import { authenticateFromCookie } from "./auth";

const SECRET = "test-secret-with-enough-entropy-1234567890";

async function sessionCookie(name: string, token: Record<string, unknown>) {
  const jwt = await encode({ token, secret: SECRET, salt: name });
  return `${name}=${jwt}`;
}

describe("authenticateFromCookie", () => {
  beforeAll(() => {
    process.env.AUTH_SECRET = SECRET;
  });

  it("returns the user id from the NextAuth session cookie (http)", async () => {
    const cookie = await sessionCookie("authjs.session-token", { id: "user-1", sub: "user-1" });
    expect(await authenticateFromCookie({ headers: { cookie }, auth: {} })).toBe("user-1");
  });

  it("returns the user id from the __Secure- cookie used over https", async () => {
    const cookie = await sessionCookie("__Secure-authjs.session-token", { id: "user-2", sub: "user-2" });
    expect(await authenticateFromCookie({ headers: { cookie }, auth: {} })).toBe("user-2");
  });

  it("returns null for anonymous players", async () => {
    expect(await authenticateFromCookie({ headers: {}, auth: {} })).toBeNull();
  });

  it("returns null for a forged cookie", async () => {
    const forged = await encode({ token: { id: "admin" }, secret: "another-secret-another-secret-123", salt: "authjs.session-token" });
    expect(await authenticateFromCookie({ headers: { cookie: `authjs.session-token=${forged}` }, auth: {} })).toBeNull();
  });
});
