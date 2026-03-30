import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { users, verificationTokens } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

const schema = z.object({
  userId: z.string().uuid(),
  code: z.string().length(6),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dati non validi" },
        { status: 400 }
      );
    }

    const { userId, code } = parsed.data;

    const [token] = await db
      .select()
      .from(verificationTokens)
      .where(
        and(
          eq(verificationTokens.userId, userId),
          eq(verificationTokens.code, code)
        )
      )
      .limit(1);

    if (!token) {
      return NextResponse.json(
        { error: "Codice non valido" },
        { status: 400 }
      );
    }

    if (token.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "Codice scaduto. Richiedi un nuovo codice nella pagina di registrazione." },
        { status: 400 }
      );
    }

    await db
      .update(users)
      .set({ emailVerified: true })
      .where(eq(users.id, userId));

    await db
      .delete(verificationTokens)
      .where(eq(verificationTokens.userId, userId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Email verification error:", error);
    return NextResponse.json(
      { error: "Errore durante la verifica" },
      { status: 500 }
    );
  }
}
