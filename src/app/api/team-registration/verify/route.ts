import { NextResponse } from "next/server";
import { z } from "zod";
import { teamRegistrationsCol } from "@/lib/firebase/collections";

const schema = z.object({
  registrationId: z.string().min(1),
  code: z.string().length(6, "Il codice deve essere di 6 cifre"),
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

    const { registrationId, code } = parsed.data;

    const regDoc = await teamRegistrationsCol().doc(registrationId).get();
    if (!regDoc.exists) {
      return NextResponse.json(
        { error: "Registrazione non trovata" },
        { status: 404 }
      );
    }

    const reg = regDoc.data()!;

    if (reg.verified) {
      // Already verified – let the team proceed
      return NextResponse.json({ success: true, teamName: reg.teamName });
    }

    if (reg.code !== code) {
      return NextResponse.json(
        { error: "Codice non valido" },
        { status: 400 }
      );
    }

    if (reg.codeExpiresAt.toDate() < new Date()) {
      return NextResponse.json(
        { error: "Codice scaduto. Richiedi un nuovo codice." },
        { status: 400 }
      );
    }

    await teamRegistrationsCol().doc(registrationId).update({ verified: true });

    return NextResponse.json({ success: true, teamName: reg.teamName });
  } catch (error) {
    console.error("Team registration verify error:", error);
    return NextResponse.json(
      { error: "Errore durante la verifica" },
      { status: 500 }
    );
  }
}
