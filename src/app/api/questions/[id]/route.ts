import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { questions } from "@/lib/db/schema";
import { auth } from "@/lib/auth/config";
import { eq, and } from "drizzle-orm";

const updateQuestionSchema = z.object({
  text: z.string().min(1).optional(),
  choices: z.array(z.string().min(1)).min(2).max(6).optional(),
  correctIndex: z.number().int().min(0).optional(),
  category: z.string().nullable().optional(),
});

async function getQuestionIfAuthorized(questionId: string, userId: string, userRole: string) {
  const [question] = await db
    .select()
    .from(questions)
    .where(eq(questions.id, questionId))
    .limit(1);

  if (!question) return { error: "Domanda non trovata", status: 404 };

  if (question.ownerId !== userId && userRole !== "admin") {
    return { error: "Non autorizzato a modificare questa domanda", status: 403 };
  }

  return { question };
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

    const { id } = await params;
    const userRole = (session.user as { role: string }).role;
    const result = await getQuestionIfAuthorized(id, session.user.id, userRole);

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const body = await request.json();
    const parsed = updateQuestionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const data = parsed.data;

    if (data.correctIndex !== undefined && data.choices) {
      if (data.correctIndex >= data.choices.length) {
        return NextResponse.json(
          { error: "L'indice della risposta corretta non è valido" },
          { status: 400 }
        );
      }
    }

    const [updated] = await db
      .update(questions)
      .set(data)
      .where(eq(questions.id, id))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update question error:", error);
    return NextResponse.json(
      { error: "Errore durante l'aggiornamento della domanda" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

    const { id } = await params;
    const userRole = (session.user as { role: string }).role;
    const result = await getQuestionIfAuthorized(id, session.user.id, userRole);

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    await db.delete(questions).where(eq(questions.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete question error:", error);
    return NextResponse.json(
      { error: "Errore durante l'eliminazione della domanda" },
      { status: 500 }
    );
  }
}
