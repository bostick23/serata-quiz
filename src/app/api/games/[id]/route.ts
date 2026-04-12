import { NextResponse } from "next/server";
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

    // Fetch question details for each gameQuestion
    const gameQuestionsData = await Promise.all(
      gqSnap.docs.map(async (gqDoc) => {
        const gq = gqDoc.data();
        const qDoc = await questionsCol().doc(gq.questionId).get();
        const q = qDoc.data();
        return {
          id: gqDoc.id,
          position: gq.position,
          startedAt: gq.startedAt?.toDate?.() ?? null,
          question: q ? {
            id: qDoc.id,
            text: q.text,
            choices: q.choices,
            correctIndex: q.correctIndex,
            category: q.category,
          } : null,
        };
      })
    );

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
