import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { games, gameQuestions, questions } from "@/lib/db/schema";
import { auth } from "@/lib/auth/config";
import { generateJoinCode } from "@/lib/utils/join-code";
import { eq, or, isNull, desc, and, inArray, notInArray, gte, sql } from "drizzle-orm";

const createGameSchema = z.object({
  numQuestions: z.number().int().min(1).max(50),
  language: z.enum(["it", "en"]).default("it"),
  categories: z.array(z.string()).optional(),
  avoidRepeat: z.boolean().default(false),
});

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

    const body = await request.json();
    const parsed = createGameSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { numQuestions, language, categories, avoidRepeat } = parsed.data;
    const totalQuestions = numQuestions;

    const categoryFilter =
      categories && categories.length > 0
        ? inArray(questions.category, categories)
        : undefined;

    // If avoidRepeat is on, find question IDs already used today
    let usedTodayFilter = undefined;
    if (avoidRepeat) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const usedToday = await db
        .select({ questionId: gameQuestions.questionId })
        .from(gameQuestions)
        .innerJoin(games, eq(gameQuestions.gameId, games.id))
        .where(gte(games.createdAt, todayStart));

      const usedIds = usedToday.map(r => r.questionId);
      if (usedIds.length > 0) {
        usedTodayFilter = notInArray(questions.id, usedIds);
      }
    }

    const availableQuestions = await db
      .select()
      .from(questions)
      .where(
        and(
          eq(questions.language, language),
          or(isNull(questions.ownerId), eq(questions.ownerId, session.user.id)),
          categoryFilter,
          usedTodayFilter
        )
      );

    if (availableQuestions.length < totalQuestions) {
      const hint = avoidRepeat ? " Prova a disattivare 'Evita ripetizioni'." : "";
      return NextResponse.json(
        {
          error: `Non ci sono abbastanza domande. Servono ${totalQuestions}, disponibili ${availableQuestions.length}.${hint}`,
        },
        { status: 400 }
      );
    }

    const shuffled = shuffle(availableQuestions).slice(0, totalQuestions);
    const joinCode = generateJoinCode();

    const [game] = await db
      .insert(games)
      .values({
        hostId: session.user.id,
        joinCode,
        language,
        numQuestions,
      })
      .returning();

    const gameQuestionValues = shuffled.map((q, index) => ({
      gameId: game.id,
      questionId: q.id,
      position: index + 1,
    }));

    await db.insert(gameQuestions).values(gameQuestionValues);

    return NextResponse.json(game, { status: 201 });
  } catch (error) {
    console.error("Create game error:", error);
    return NextResponse.json(
      { error: "Errore durante la creazione del gioco" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

    const userGames = await db
      .select()
      .from(games)
      .where(eq(games.hostId, session.user.id))
      .orderBy(desc(games.createdAt));

    return NextResponse.json(userGames);
  } catch (error) {
    console.error("Get games error:", error);
    return NextResponse.json(
      { error: "Errore durante il recupero dei giochi" },
      { status: 500 }
    );
  }
}
