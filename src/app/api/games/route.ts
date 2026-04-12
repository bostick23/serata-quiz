import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/firebase";
import { questionsCol, gamesCol, gameQuestionsCol, uniqueJoinCodesCol } from "@/lib/firebase/collections";
import { auth } from "@/lib/auth/config";
import { generateJoinCode } from "@/lib/utils/join-code";
import { Timestamp } from "firebase-admin/firestore";

const createGameSchema = z.object({
  numQuestions: z.number().int().min(1).max(50),
  maxPerCategory: z.number().int().min(1).max(50).default(2),
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

    const { numQuestions, maxPerCategory, language, categories, avoidRepeat } = parsed.data;
    const totalQuestions = numQuestions;

    // Fetch available questions (public + user's own)
    const [publicSnap, userSnap] = await Promise.all([
      questionsCol().where("ownerId", "==", null).where("language", "==", language).get(),
      questionsCol().where("ownerId", "==", session.user.id).where("language", "==", language).get(),
    ]);

    let availableQuestions = [
      ...publicSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
      ...userSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
    ];

    // Filter by categories if specified
    if (categories && categories.length > 0) {
      availableQuestions = availableQuestions.filter(q => q.category && categories.includes(q.category));
    }

    // Filter out questions used today if avoidRepeat
    if (avoidRepeat) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayTimestamp = Timestamp.fromDate(todayStart);

      // Find games created today
      const todayGames = await gamesCol()
        .where("createdAt", ">=", todayTimestamp)
        .get();

      // Collect all questionIds used today
      const usedIds = new Set<string>();
      for (const gameDoc of todayGames.docs) {
        const gqSnap = await gameQuestionsCol(gameDoc.id).get();
        gqSnap.docs.forEach(doc => usedIds.add(doc.data().questionId));
      }

      if (usedIds.size > 0) {
        availableQuestions = availableQuestions.filter(q => !usedIds.has(q.id));
      }
    }

    if (availableQuestions.length < totalQuestions) {
      const hint = avoidRepeat ? " Prova a disattivare 'Evita ripetizioni'." : "";
      return NextResponse.json(
        {
          error: `Non ci sono abbastanza domande. Servono ${totalQuestions}, disponibili ${availableQuestions.length}.${hint}`,
        },
        { status: 400 }
      );
    }

    // Select questions with max per category limit
    const shuffledAll = shuffle(availableQuestions);
    const categoryCounts = new Map<string, number>();
    const shuffled: typeof availableQuestions = [];
    for (const q of shuffledAll) {
      const cat = q.category ?? "unknown";
      const count = categoryCounts.get(cat) ?? 0;
      if (count >= maxPerCategory) continue;
      categoryCounts.set(cat, count + 1);
      shuffled.push(q);
      if (shuffled.length >= totalQuestions) break;
    }

    if (shuffled.length < totalQuestions) {
      const hint = avoidRepeat ? " Prova a disattivare 'Evita ripetizioni'." : "";
      return NextResponse.json(
        {
          error: `Non ci sono abbastanza domande con il limite di ${maxPerCategory} per categoria. Servono ${totalQuestions}, selezionabili ${shuffled.length}.${hint}`,
        },
        { status: 400 }
      );
    }

    // Create game with unique joinCode (transactional)
    const joinCode = generateJoinCode();
    const gameRef = gamesCol().doc();
    const gameData = {
      hostId: session.user.id,
      joinCode,
      status: "lobby" as const,
      language,
      numQuestions,
      currentQuestionIndex: 0,
      createdAt: Timestamp.now(),
    };

    await db.runTransaction(async (tx) => {
      const joinCodeRef = uniqueJoinCodesCol().doc(joinCode);
      const existing = await tx.get(joinCodeRef);
      if (existing.exists) throw new Error("JOIN_CODE_TAKEN");

      tx.set(gameRef, gameData);
      tx.set(joinCodeRef, { gameId: gameRef.id });
    });

    // Batch write game questions
    const batch = db.batch();
    for (let i = 0; i < shuffled.length; i++) {
      const gqRef = gameQuestionsCol(gameRef.id).doc();
      batch.set(gqRef, {
        questionId: shuffled[i].id,
        position: i + 1,
        startedAt: null,
      });
    }
    await batch.commit();

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

    const userGames = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() ?? new Date(),
    }));

    return NextResponse.json(userGames);
  } catch (error) {
    console.error("Get games error:", error);
    return NextResponse.json(
      { error: "Errore durante il recupero dei giochi" },
      { status: 500 }
    );
  }
}
