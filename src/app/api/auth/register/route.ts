import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { users, verificationTokens } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/helpers";
import { generateCode, sendVerificationEmail } from "@/lib/email";
import { eq } from "drizzle-orm";

const registerSchema = z.object({
  email: z.string().email("Email non valida"),
  password: z.string().min(6, "La password deve avere almeno 6 caratteri"),
  displayName: z.string().min(2, "Il nome deve avere almeno 2 caratteri"),
});

// Minimum interval between re-sends: 2 minutes
const RESEND_COOLDOWN_MS = 2 * 60 * 1000;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { email, password, displayName } = parsed.data;

    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing) {
      if (!existing.emailVerified) {
        // Check if a recent token was already sent (rate limiting)
        const cooldownCutoff = new Date(Date.now() - RESEND_COOLDOWN_MS);
        const [recentToken] = await db
          .select()
          .from(verificationTokens)
          .where(
            eq(verificationTokens.userId, existing.id)
          )
          .limit(1);

        if (recentToken && recentToken.createdAt > cooldownCutoff) {
          return NextResponse.json({ userId: existing.id }, { status: 200 });
        }

        // Re-send verification code for unverified account
        const code = generateCode();
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
        await db.delete(verificationTokens).where(eq(verificationTokens.userId, existing.id));
        await db.insert(verificationTokens).values({ userId: existing.id, code, expiresAt });
        await sendVerificationEmail(existing.email, existing.displayName, code);
        return NextResponse.json({ userId: existing.id }, { status: 200 });
      }
      return NextResponse.json(
        { error: "Email già registrata" },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);

    const [user] = await db
      .insert(users)
      .values({ email, passwordHash, displayName, emailVerified: false })
      .returning({ id: users.id, email: users.email, displayName: users.displayName });

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await db.insert(verificationTokens).values({ userId: user.id, code, expiresAt });
    await sendVerificationEmail(user.email, user.displayName, code);

    return NextResponse.json({ userId: user.id }, { status: 201 });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Errore durante la registrazione" },
      { status: 500 }
    );
  }
}
