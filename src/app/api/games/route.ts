import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/firebase";
import { gamesCol, gameQuestionsCol, uniqueJoinCodesCol } from "@/lib/firebase/collections";
import { auth } from "@/lib/auth/config";
import { generateJoinCode } from "@/lib/utils/join-code";
import { Timestamp } from "firebase-admin/firestore";
import { getPublicQuestions, getUserQuestions } from "@/lib/questions/public-questions";
import { pickQuestions } from "@/lib/questions/pick-questions";
import { startOfDayInTimeZone } from "@/lib/questions/time";

const createGameSchema = z.object({
  numQuestions: z.number().int().min(1).max(50),
  maxPerCategory: z.number().int().min(1).max(50).default(2),
  language: z.enum(["it", "en"]).default("it"),
  categories: z.array(z.string()).optional(),
  avoidRepeat: z.boolean().default(false),
});

const GAME_TIME_ZONE = "Europe/Rome";
const JOIN_CODE_ATTEMPTS = 5;

/** Question ids used today (Rome time) by this host's games. */
async function questionIdsUsedToday(hostId: string): Promise<Set<string>> {
  const start = Timestamp.fromDate(startOfDayInTimeZone(new Date(), GAME_TIME_ZONE));
  // Same shape as the dashboard query (hostId == x, orderBy createdAt desc): reuses its index.
  const todayGames = await gamesCol().where("hostId", "==", hostId).orderBy("createdAt", "desc").endAt(start).get();

  const used = new Set<string>();
  const legacy: string[] = [];
  for (const doc of todayGames.docs) {
    const ids = doc.data().questionIds;
    if (ids) ids.forEach(id => used.add(id));
    else legacy.push(doc.id);
  }
  // Games created before `questionIds` existed: read their questions in parallel.
  const snaps = await Promise.all(legacy.map(id => gameQuestionsCol(id).get()));
  for (const snap of snaps) snap.docs.forEach(doc => used.add(doc.data().questionId));
  return used;
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    const userId = session.user.id;

    const body = await request.json();
    const parsed = createGameSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { numQuestions, maxPerCategory, language, categories, avoidRepeat } = parsed.data;

    const [publicQuestions, userQuestions, excludeIds] = await Promise.all([
      getPublicQuestions(language),
      getUserQuestions(userId, language),
      avoidRepeat ? questionIdsUsedToday(userId) : Promise.resolve(undefined),
    ]);

    const result = pickQuestions([...publicQuestions, ...userQuestions], { numQuestions, maxPerCategory, categories, excludeIds });
    if (!result.ok) {
      const hint = avoidRepeat ? " Prova a disattivare 'Evita ripetizioni'." : "";
      const error =
        result.reason === "not-enough"
          ? `Non ci sono abbastanza domande. Servono ${numQuestions}, disponibili ${result.available}.${hint}`
          : `Non ci sono abbastanza domande con il limite di ${maxPerCategory} per categoria. Servono ${numQuestions}, selezionabili ${result.selectable}.${hint}`;
      return NextResponse.json({ error }, { status: 400 });
    }
    const selected = result.questions;

    const gameRef = gamesCol().doc();
    let gameData: {
      hostId: string;
      joinCode: string;
      status: "lobby";
      language: string;
      numQuestions: number;
      currentQuestionIndex: number;
      createdAt: Timestamp;
      questionIds: string[];
    } | null = null;

    // Game, join code and questions are written atomically; retry on the (rare) join code collision.
    for (let attempt = 0; attempt < JOIN_CODE_ATTEMPTS && !gameData; attempt++) {
      const candidate = {
        hostId: userId,
        joinCode: generateJoinCode(),
        status: "lobby" as const,
        language,
        numQuestions,
        currentQuestionIndex: 0,
        createdAt: Timestamp.now(),
        questionIds: selected.map(q => q.id),
      };
      const created = await db.runTransaction(async (tx) => {
        const joinCodeRef = uniqueJoinCodesCol().doc(candidate.joinCode);
        const existing = await tx.get(joinCodeRef);
        if (existing.exists) return false;

        tx.set(gameRef, candidate);
        tx.set(joinCodeRef, { gameId: gameRef.id });
        selected.forEach((q, i) => {
          // Snapshot of the question: the game no longer depends on later edits/deletions.
          tx.set(gameQuestionsCol(gameRef.id).doc(), {
            questionId: q.id,
            position: i + 1,
            startedAt: null,
            category: q.category,
            text: q.text,
            choices: q.choices,
            correctIndex: q.correctIndex,
          });
        });
        return true;
      });
      if (created) gameData = candidate;
    }

    if (!gameData) throw new Error("Could not allocate a unique join code");

    return NextResponse.json({ id: gameRef.id, ...gameData, createdAt: new Date() }, { status: 201 });
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

    const snap = await gamesCol()
      .where("hostId", "==", session.user.id)
      .orderBy("createdAt", "desc")
      .get();

    const userGames = snap.docs.map(doc => {
      // questionIds is internal bookkeeping: keep the dashboard payload small.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { questionIds, ...game } = doc.data();
      return {
        id: doc.id,
        ...game,
        createdAt: game.createdAt?.toDate?.() ?? new Date(),
      };
    });

    return NextResponse.json(userGames);
  } catch (error) {
    console.error("Get games error:", error);
    return NextResponse.json(
      { error: "Errore durante il recupero dei giochi" },
      { status: 500 }
    );
  }
}
