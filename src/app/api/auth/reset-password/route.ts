import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { users, passwordResetTokens } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/helpers";
import { eq, and } from "drizzle-orm";

const schema = z.object({
  email: z.string().email("Email non valida"),
  code: z.string().length(6),
  newPassword: z.string().min(6, "La password deve avere almeno 6 caratteri"),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { email, code, newPassword } = parsed.data;

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      return NextResponse.json(
        { error: "Codice non valido o scaduto" },
        { status: 400 }
      );
    }

    const [token] = await db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.userId, user.id),
          eq(passwordResetTokens.code, code)
        )
      )
      .limit(1);

    if (!token) {
      return NextResponse.json(
        { error: "Codice non valido o scaduto" },
        { status: 400 }
      );
    }

    if (token.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "Codice scaduto. Richiedi un nuovo codice." },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(newPassword);

    await db
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, user.id));

    await db
      .delete(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, user.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json(
      { error: "Errore durante il reset della password" },
      { status: 500 }
    );
  }
}
