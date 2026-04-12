import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/firebase";
import { usersCol, verificationTokensCol } from "@/lib/firebase/collections";

const schema = z.object({
  userId: z.string().min(1),
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

    // Find matching token
    const tokensSnap = await verificationTokensCol(userId)
      .where("code", "==", code)
      .limit(1)
      .get();

    if (tokensSnap.empty) {
      return NextResponse.json(
        { error: "Codice non valido" },
        { status: 400 }
      );
    }

    const token = tokensSnap.docs[0].data();

    if (token.expiresAt.toDate() < new Date()) {
      return NextResponse.json(
        { error: "Codice scaduto. Richiedi un nuovo codice nella pagina di registrazione." },
        { status: 400 }
      );
    }

    // Mark email as verified and delete all tokens
    await usersCol().doc(userId).update({ emailVerified: true });

    const allTokens = await verificationTokensCol(userId).get();
    const batch = db.batch();
    allTokens.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Email verification error:", error);
    return NextResponse.json(
      { error: "Errore durante la verifica" },
      { status: 500 }
    );
  }
}
