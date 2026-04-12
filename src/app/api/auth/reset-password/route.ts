import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/firebase";
import { usersCol, uniqueEmailsCol, passwordResetTokensCol } from "@/lib/firebase/collections";
import { hashPassword } from "@/lib/auth/helpers";

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

    const { email: rawEmail, code, newPassword } = parsed.data;
    const email = rawEmail.toLowerCase().trim();

    const emailDoc = await uniqueEmailsCol().doc(email).get();
    if (!emailDoc.exists) {
      return NextResponse.json(
        { error: "Codice non valido o scaduto" },
        { status: 400 }
      );
    }

    const { userId } = emailDoc.data()!;

    // Find matching token
    const tokensSnap = await passwordResetTokensCol(userId)
      .where("code", "==", code)
      .limit(1)
      .get();

    if (tokensSnap.empty) {
      return NextResponse.json(
        { error: "Codice non valido o scaduto" },
        { status: 400 }
      );
    }

    const token = tokensSnap.docs[0].data();

    if (token.expiresAt.toDate() < new Date()) {
      return NextResponse.json(
        { error: "Codice scaduto. Richiedi un nuovo codice." },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(newPassword);

    await usersCol().doc(userId).update({ passwordHash });

    // Delete all reset tokens
    const allTokens = await passwordResetTokensCol(userId).get();
    const batch = db.batch();
    allTokens.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json(
      { error: "Errore durante il reset della password" },
      { status: 500 }
    );
  }
}
