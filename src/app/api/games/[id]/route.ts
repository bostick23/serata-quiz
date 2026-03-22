import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { games, teams, gameQuestions, questions } from "@/lib/db/schema";
import { auth } from "@/lib/auth/config";
import { eq } from "drizzle-orm";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

    const { id } = await params;

    const [game] = await db
      .select()
      .from(games)
      .where(eq(games.id, id))
      .limit(1);

    if (!game) {
      return NextResponse.json(
        { error: "Gioco non trovato" },
        { status: 404 }
      );
    }

    const gameTeams = await db
      .select()
      .from(teams)
      .where(eq(teams.gameId, id));

    const gameQuestionsData = await db
      .select({
        id: gameQuestions.id,
        roundNumber: gameQuestions.roundNumber,
        position: gameQuestions.position,
        startedAt: gameQuestions.startedAt,
        question: {
          id: questions.id,
          text: questions.text,
          choices: questions.choices,
          correctIndex: questions.correctIndex,
          category: questions.category,
        },
      })
      .from(gameQuestions)
      .innerJoin(questions, eq(gameQuestions.questionId, questions.id))
      .where(eq(gameQuestions.gameId, id));

    return NextResponse.json({
      ...game,
      teams: gameTeams,
      questions: gameQuestionsData,
    });
  } catch (error) {
    console.error("Get game error:", error);
    return NextResponse.json(
      { error: "Errore durante il recupero del gioco" },
      { status: 500 }
    );
  }
}
