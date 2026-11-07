import { NextResponse } from "next/server";
import { z } from "zod";
import { questionsCol } from "@/lib/firebase/collections";
import { auth } from "@/lib/auth/config";
import { Timestamp } from "firebase-admin/firestore";

const createQuestionSchema = z.object({
  text: z.string().min(1, "Il testo della domanda è obbligatorio"),
  choices: z
    .array(z.string().min(1))
    .min(2, "Servono almeno 2 risposte")
    .max(6, "Massimo 6 risposte"),
  correctIndex: z.number().int().min(0),
  category: z.string().optional(),
});

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

    // "Le mie domande": hosts only see (and can only edit) their own questions.
    // Admins also manage the public bank, so they keep getting it.
    const isAdmin = (session.user as { role?: string }).role === "admin";
    const [publicSnap, userSnap] = await Promise.all([
      isAdmin ? questionsCol().where("ownerId", "==", null).get() : Promise.resolve(null),
      questionsCol().where("ownerId", "==", session.user.id).get(),
    ]);

    const allQuestions = [...(publicSnap?.docs ?? []), ...userSnap.docs].map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() ?? new Date(),
    }));

    allQuestions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json(allQuestions);
  } catch (error) {
    console.error("Get questions error:", error);
    return NextResponse.json(
      { error: "Errore durante il recupero delle domande" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

    const body = await request.json();
    const parsed = createQuestionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { text, choices, correctIndex, category } = parsed.data;

    if (correctIndex >= choices.length) {
      return NextResponse.json(
        { error: "L'indice della risposta corretta non è valido" },
        { status: 400 }
      );
    }

    const ref = questionsCol().doc();
    const data = {
      ownerId: session.user.id,
      text,
      choices,
      correctIndex,
      category: category ?? null,
      language: "it" as string,
      createdAt: Timestamp.now(),
    };
    await ref.set(data);

    return NextResponse.json({ id: ref.id, ...data, createdAt: new Date() }, { status: 201 });
  } catch (error) {
    console.error("Create question error:", error);
    return NextResponse.json(
      { error: "Errore durante la creazione della domanda" },
      { status: 500 }
    );
  }
}
