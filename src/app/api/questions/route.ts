import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { questions } from "@/lib/db/schema";
import { auth } from "@/lib/auth/config";
import { eq, or, isNull, desc } from "drizzle-orm";

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

    const userQuestions = await db
      .select()
      .from(questions)
      .where(
        or(isNull(questions.ownerId), eq(questions.ownerId, session.user.id))
      )
      .orderBy(desc(questions.createdAt));

    return NextResponse.json(userQuestions);
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

    const [question] = await db
      .insert(questions)
      .values({
        ownerId: session.user.id,
        text,
        choices,
        correctIndex,
        category: category ?? null,
      })
      .returning();

    return NextResponse.json(question, { status: 201 });
  } catch (error) {
    console.error("Create question error:", error);
    return NextResponse.json(
      { error: "Errore durante la creazione della domanda" },
      { status: 500 }
    );
  }
}
