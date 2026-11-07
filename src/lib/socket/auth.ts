import { getToken } from "next-auth/jwt";
import type { Handshake } from "./game-manager";

/** Reads the NextAuth (v5) JWT from the session cookie sent with the Socket.io handshake. */
export async function authenticateFromCookie(handshake: Handshake): Promise<string | null> {
  const cookie = handshake.headers.cookie;
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!cookie || !secret) return null;

  // The cookie is "__Secure-" prefixed when the site is served over HTTPS (also behind a proxy).
  for (const secureCookie of [true, false]) {
    const token = await getToken({ req: { headers: { cookie } }, secret, secureCookie });
    if (token) {
      const id = typeof token.id === "string" ? token.id : token.sub;
      if (id) return id;
    }
  }
  return null;
}
