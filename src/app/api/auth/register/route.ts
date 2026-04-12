import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/firebase";
import { usersCol, uniqueEmailsCol, verificationTokensCol } from "@/lib/firebase/collections";
import { hashPassword } from "@/lib/auth/helpers";
import { generateCode, sendVerificationEmail } from "@/lib/email";
import { Timestamp } from "firebase-admin/firestore";

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

    const { email: rawEmail, password, displayName } = parsed.data;
    const email = rawEmail.toLowerCase().trim();

    // Check if email already registered
    const emailDoc = await uniqueEmailsCol().doc(email).get();

    if (emailDoc.exists) {
      const { userId } = emailDoc.data()!;
      const userDoc = await usersCol().doc(userId).get();
      const existing = userDoc.data();

      if (existing && !existing.emailVerified) {
        // Check rate limiting on recent token
        const tokensSnap = await verificationTokensCol(userId).limit(1).get();
        if (!tokensSnap.empty) {
          const recentToken = tokensSnap.docs[0].data();
          if (recentToken.createdAt.toDate() > new Date(Date.now() - RESEND_COOLDOWN_MS)) {
            return NextResponse.json({ userId }, { status: 200 });
          }
        }

        // Re-send verification code
        const code = generateCode();
        const expiresAt = Timestamp.fromDate(new Date(Date.now() + 30 * 60 * 1000));

        // Delete old tokens
        const oldTokens = await verificationTokensCol(userId).get();
        const batch = db.batch();
        oldTokens.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();

        await verificationTokensCol(userId).add({
          code,
          expiresAt,
          createdAt: Timestamp.now(),
        });
        await sendVerificationEmail(existing.email, existing.displayName, code);
        return NextResponse.json({ userId }, { status: 200 });
      }

      return NextResponse.json(
        { error: "Email già registrata" },
        { status: 409 }
      );
    }

    // Create new user atomically with uniqueEmail lookup
    const passwordHash = await hashPassword(password);
    const userRef = usersCol().doc(); // auto-ID
    const userId = userRef.id;

    await db.runTransaction(async (tx) => {
      // Double-check email uniqueness inside transaction
      const emailRef = uniqueEmailsCol().doc(email);
      const emailSnap = await tx.get(emailRef);
      if (emailSnap.exists) {
        throw new Error("EMAIL_TAKEN");
      }

      tx.set(userRef, {
        email,
        passwordHash,
        displayName,
        role: "host",
        emailVerified: false,
        createdAt: Timestamp.now(),
      });

      tx.set(emailRef, { userId });
    });

    const code = generateCode();
    const expiresAt = Timestamp.fromDate(new Date(Date.now() + 30 * 60 * 1000));
    await verificationTokensCol(userId).add({
      code,
      expiresAt,
      createdAt: Timestamp.now(),
    });
    await sendVerificationEmail(email, displayName, code);

    return NextResponse.json({ userId }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "EMAIL_TAKEN") {
      return NextResponse.json(
        { error: "Email già registrata" },
        { status: 409 }
      );
    }
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Errore durante la registrazione" },
      { status: 500 }
    );
  }
}
