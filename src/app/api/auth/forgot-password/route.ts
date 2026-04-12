import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/firebase";
import { usersCol, uniqueEmailsCol, passwordResetTokensCol } from "@/lib/firebase/collections";
import { generateCode, sendPasswordResetEmail } from "@/lib/email";
import { Timestamp } from "firebase-admin/firestore";

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

    const email = parsed.data.email.toLowerCase().trim();

    // Look up user via uniqueEmails
    const emailDoc = await uniqueEmailsCol().doc(email).get();

    // Always return success to avoid email enumeration
    if (!emailDoc.exists) {
      return NextResponse.json({ success: true });
    }

    const { userId } = emailDoc.data()!;
    const userDoc = await usersCol().doc(userId).get();
    const user = userDoc.data();

    if (!user || !user.emailVerified) {
      return NextResponse.json({ success: true });
    }

    const code = generateCode();
    const expiresAt = Timestamp.fromDate(new Date(Date.now() + 30 * 60 * 1000));

    // Delete old tokens
    const oldTokens = await passwordResetTokensCol(userId).get();
    const batch = db.batch();
    oldTokens.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    await passwordResetTokensCol(userId).add({
      code,
      expiresAt,
      createdAt: Timestamp.now(),
    });

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
