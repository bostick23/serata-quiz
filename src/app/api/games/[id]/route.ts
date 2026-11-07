import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { gamesCol, teamsCol, gameQuestionsCol, questionsCol } from "@/lib/firebase/collections";
import { auth } from "@/lib/auth/config";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

    const { id } = await params;

    const gameDoc = await gamesCol().doc(id).get();

    if (!gameDoc.exists) {
      return NextResponse.json(
        { error: "Gioco non trovato" },
        { status: 404 }
      );
    }

    const game = { id: gameDoc.id, ...gameDoc.data()! };

    // The payload includes the correct answers: only the game's host may read it.
    if (game.hostId !== session.user.id) {
      return NextResponse.json({ error: "Gioco non trovato" }, { status: 404 });
    }

    // Fetch teams and gameQuestions in parallel
    const [teamsSnap, gqSnap] = await Promise.all([
      teamsCol(id).get(),
      gameQuestionsCol(id).orderBy("position").get(),
    ]);

    const gameTeams = teamsSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() ?? new Date(),
    }));

    // Question details: from the snapshot stored with the game, or (older games) one batched read.
    const legacyIds = gqSnap.docs.map(d => d.data()).filter(gq => gq.text === undefined).map(gq => gq.questionId);
    const legacyDocs = legacyIds.length > 0 ? await db.getAll(...legacyIds.map(qid => questionsCol().doc(qid))) : [];
    const legacyById = new Map(legacyDocs.map(d => [d.id, d.data() as { text: string; choices: string[]; correctIndex: number; category: string | null } | undefined]));

    const gameQuestionsData = gqSnap.docs.map((gqDoc) => {
      const gq = gqDoc.data();
      const q = gq.text !== undefined && gq.choices && gq.correctIndex !== undefined
        ? { text: gq.text, choices: gq.choices, correctIndex: gq.correctIndex, category: gq.category ?? null }
        : legacyById.get(gq.questionId);
      return {
        id: gqDoc.id,
        position: gq.position,
        startedAt: gq.startedAt?.toDate?.() ?? null,
        question: q ? {
          id: gq.questionId,
          text: q.text,
          choices: q.choices,
          correctIndex: q.correctIndex,
          category: q.category,
        } : null,
      };
    });

    return NextResponse.json({
      ...game,
      createdAt: game.createdAt?.toDate?.() ?? new Date(),
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
