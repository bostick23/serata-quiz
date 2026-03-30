import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { users, passwordResetTokens } from "@/lib/db/schema";
import { generateCode, sendPasswordResetEmail } from "@/lib/email";
import { eq } from "drizzle-orm";

const schema = z.object({
  email: z.string().email("Email non valida"),
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

    const { email } = parsed.data;

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    // Always return success to avoid email enumeration
    if (!user || !user.emailVerified) {
      return NextResponse.json({ success: true });
    }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await db
      .delete(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, user.id));

    await db
      .insert(passwordResetTokens)
      .values({ userId: user.id, code, expiresAt });

    await sendPasswordResetEmail(user.email, code);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { error: "Errore durante l'elaborazione della richiesta" },
      { status: 500 }
    );
  }
}
