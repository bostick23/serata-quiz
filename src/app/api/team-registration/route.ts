import { NextResponse } from "next/server";
import { z } from "zod";
import { teamRegistrationsCol, uniqueJoinCodesCol } from "@/lib/firebase/collections";
import { generateCode, sendTeamRegistrationEmail } from "@/lib/email";
import { Timestamp } from "firebase-admin/firestore";

const schema = z.object({
  teamName: z.string().min(1, "Il nome della squadra è obbligatorio").max(50),
  email: z.string().email("Email non valida"),
  joinCode: z.string().min(1, "Codice partita obbligatorio"),
});

// Minimum interval between resends for the same email+joinCode: 2 minutes
const RESEND_COOLDOWN_MS = 2 * 60 * 1000;

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

    const { teamName, email: rawEmail, joinCode } = parsed.data;
    const email = rawEmail.toLowerCase().trim();

    // Verify the game exists
    const joinCodeDoc = await uniqueJoinCodesCol().doc(joinCode).get();
    if (!joinCodeDoc.exists) {
      return NextResponse.json({ error: "Partita non trovata" }, { status: 404 });
    }

    // Rate-limit: check for a recent unverified registration for same email+joinCode
    const recentSnap = await teamRegistrationsCol()
      .where("email", "==", email)
      .where("joinCode", "==", joinCode)
      .where("verified", "==", false)
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();

    if (!recentSnap.empty) {
      const recent = recentSnap.docs[0].data();
      const createdAt = recent.createdAt.toDate();
      if (createdAt > new Date(Date.now() - RESEND_COOLDOWN_MS)) {
        // Return existing registrationId so the user can retry the code
        return NextResponse.json(
          { registrationId: recentSnap.docs[0].id },
          { status: 200 }
        );
      }
    }

    const code = generateCode();
    const codeExpiresAt = Timestamp.fromDate(new Date(Date.now() + 30 * 60 * 1000));

    const regRef = teamRegistrationsCol().doc();
    await regRef.set({
      teamName,
      email,
      joinCode,
      code,
      codeExpiresAt,
      verified: false,
      createdAt: Timestamp.now(),
    });

    await sendTeamRegistrationEmail(email, teamName, code);

    return NextResponse.json({ registrationId: regRef.id }, { status: 201 });
  } catch (error) {
    console.error("Team registration error:", error);
    return NextResponse.json(
      { error: "Errore durante la registrazione" },
      { status: 500 }
    );
  }
}
