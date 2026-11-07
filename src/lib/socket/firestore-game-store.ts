import { Timestamp } from "firebase-admin/firestore";
import { db } from "@/lib/firebase";
import {
  answersCol,
  gameQuestionsCol,
  gamesCol,
  questionsCol,
  teamsCol,
  uniqueJoinCodesCol,
} from "@/lib/firebase/collections";
import type { EngineQuestion } from "./game-engine";
import type { GameStore, StoredGame } from "./game-store";

async function loadQuestions(gameId: string): Promise<EngineQuestion[]> {
  const gqSnap = await gameQuestionsCol(gameId).orderBy("position").get();
  const rows = gqSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  // Older games have no snapshot: fetch the missing questions in a single round trip.
  const missing = rows.filter(r => r.text === undefined || r.choices === undefined || r.correctIndex === undefined);
  const fetched = new Map<string, { text: string; choices: string[]; correctIndex: number; category: string | null }>();
  if (missing.length > 0) {
    const docs = await db.getAll(...missing.map(r => questionsCol().doc(r.questionId)));
    for (const doc of docs) {
      const q = doc.data() as { text: string; choices: string[]; correctIndex: number; category: string | null } | undefined;
      if (q) fetched.set(doc.id, q);
    }
  }

  const questions: EngineQuestion[] = [];
  for (const r of rows) {
    const source = r.text !== undefined && r.choices !== undefined && r.correctIndex !== undefined
      ? { text: r.text, choices: r.choices, correctIndex: r.correctIndex, category: r.category ?? null }
      : fetched.get(r.questionId);
    if (!source) {
      console.error(`[Game ${gameId}] Question ${r.questionId} no longer exists: skipped`);
      continue;
    }
    questions.push({
      gameQuestionId: r.id,
      questionId: r.questionId,
      // Positions are renumbered so a skipped question never leaves a hole that would stall the game.
      position: questions.length + 1,
      category: source.category ?? "Generale",
      text: source.text,
      choices: source.choices,
      correctIndex: source.correctIndex,
    });
  }
  return questions;
}

export const firestoreGameStore: GameStore = {
  async loadByJoinCode(joinCode) {
    const codeDoc = await uniqueJoinCodesCol().doc(joinCode).get();
    if (!codeDoc.exists) return null;
    const gameId = codeDoc.data()!.gameId;

    const gameDoc = await gamesCol().doc(gameId).get();
    if (!gameDoc.exists) return null;
    const game = gameDoc.data()!;

    const needsAnswers = game.status === "playing" || game.status === "finished";
    const [questions, teamsSnap, answersSnap] = await Promise.all([
      loadQuestions(gameId),
      teamsCol(gameId).orderBy("createdAt").get(),
      needsAnswers ? answersCol(gameId).get() : Promise.resolve(null),
    ]);

    const stored: StoredGame = {
      gameId,
      hostId: game.hostId,
      language: game.language ?? "it",
      status: game.status,
      numQuestions: game.numQuestions,
      currentQuestionIndex: game.currentQuestionIndex ?? 0,
      questions,
      teams: teamsSnap.docs.map(doc => {
        const t = doc.data();
        return { id: doc.id, name: t.name, photoUrl: t.photoUrl ?? null, rejoinToken: t.rejoinToken ?? null };
      }),
      answers: (answersSnap?.docs ?? []).map(doc => {
        const a = doc.data();
        return { teamId: a.teamId, gameQuestionId: a.gameQuestionId, chosenIndex: a.chosenIndex, score: a.score };
      }),
    };
    return stored;
  },

  newTeamId(gameId) {
    return teamsCol(gameId).doc().id;
  },

  async createTeam(gameId, team) {
    await teamsCol(gameId).doc(team.id).set({
      name: team.name,
      photoUrl: team.photoUrl,
      socketId: team.socketId,
      rejoinToken: team.rejoinToken,
      createdAt: Timestamp.now(),
    });
  },

  async updateTeamConnection(gameId, teamId, { socketId, rejoinToken }) {
    await teamsCol(gameId).doc(teamId).update({ socketId, rejoinToken });
  },

  async saveAnswer(gameId, answer) {
    // Deterministic id: a retried write can never create a duplicate answer.
    await answersCol(gameId).doc(`${answer.gameQuestionId}_${answer.teamId}`).set({
      ...answer,
      answeredAt: Timestamp.now(),
    });
  },

  async saveProgress(gameId, { currentQuestionIndex, gameQuestionId }) {
    const batch = db.batch();
    batch.update(gamesCol().doc(gameId), { status: "playing", currentQuestionIndex });
    batch.update(gameQuestionsCol(gameId).doc(gameQuestionId), { startedAt: Timestamp.now() });
    await batch.commit();
  },

  async markFinished(gameId) {
    await gamesCol().doc(gameId).update({ status: "finished" });
  },

  async deleteGame(gameId, joinCode) {
    await Promise.all([db.recursiveDelete(gamesCol().doc(gameId)), uniqueJoinCodesCol().doc(joinCode).delete()]);
  },
};
