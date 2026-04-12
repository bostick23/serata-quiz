import { Server, Socket } from "socket.io";
import { db } from "@/lib/firebase";
import { gamesCol, gameQuestionsCol, questionsCol, teamsCol, answersCol, uniqueJoinCodesCol } from "@/lib/firebase/collections";
import { Timestamp } from "firebase-admin/firestore";
import { calculateScore } from "./scoring";
import { CATEGORY_TIME_MS, READ_TIME_MS, ANSWER_TIME_MS } from "./events";
import type { GamePhase, QuestionData, RankingEntry, TeamInfo } from "@/types/game";

interface ActiveGame {
  joinCode: string;
  gameId: string;
  hostId: string;
  hostSocketId: string | null;
  language: string;
  phase: GamePhase;
  currentQuestionIndex: number;
  numQuestions: number;
  teams: Map<string, TeamInfo & { socketId: string }>;
  currentQuestion: QuestionData | null;
  currentCorrectIndex: number;
  answerPhaseStart: number;
  answeredTeams: Set<string>;
  questionsList: Array<{ gameQuestionId: string; questionId: string; position: number }>;
  timer: ReturnType<typeof setTimeout> | null;
  transitioning: boolean;
}

const activeGames = new Map<string, ActiveGame>();

export function getActiveGame(joinCode: string): ActiveGame | undefined {
  return activeGames.get(joinCode);
}

export async function createActiveGame(joinCode: string, gameId: string, hostId: string): Promise<ActiveGame> {
  const gameDoc = await gamesCol().doc(gameId).get();
  const game = gameDoc.data()!;

  const gqSnap = await gameQuestionsCol(gameId).orderBy("position").get();
  const questionRows = gqSnap.docs.map(doc => ({
    gameQuestionId: doc.id,
    questionId: doc.data().questionId,
    position: doc.data().position,
  }));

  const existingTeamsSnap = await teamsCol(gameId).get();

  // Determine phase from DB status and currentQuestionIndex
  let phase: GamePhase = "lobby";
  if (game.status === "playing") {
    phase = game.currentQuestionIndex > 0 ? "results" : "lobby";
  } else if (game.status === "finished") {
    phase = "finished";
  }

  const activeGame: ActiveGame = {
    joinCode,
    gameId,
    hostId,
    hostSocketId: null,
    language: game.language ?? "it",
    phase,
    currentQuestionIndex: game.currentQuestionIndex ?? 0,
    numQuestions: game.numQuestions,
    teams: new Map(),
    currentQuestion: null,
    currentCorrectIndex: -1,
    answerPhaseStart: 0,
    answeredTeams: new Set(),
    questionsList: questionRows,
    timer: null,
    transitioning: false,
  };

  for (const doc of existingTeamsSnap.docs) {
    const t = doc.data();
    activeGame.teams.set(doc.id, {
      id: doc.id,
      name: t.name,
      photoUrl: t.photoUrl,
      connected: false,
      socketId: "",
    });
  }

  activeGames.set(joinCode, activeGame);
  return activeGame;
}

export function removeActiveGame(joinCode: string) {
  const game = activeGames.get(joinCode);
  if (game?.timer) clearTimeout(game.timer);
  activeGames.delete(joinCode);
}

function getRoomName(joinCode: string) {
  return `game:${joinCode}`;
}

function getGameState(game: ActiveGame) {
  return {
    joinCode: game.joinCode,
    phase: game.phase,
    language: game.language,
    currentQuestion: game.currentQuestionIndex,
    numQuestions: game.numQuestions,
    teams: Array.from(game.teams.values()).map(({ socketId, ...rest }) => rest),
    question: game.currentQuestion ?? undefined,
    correctIndex: game.phase === "results" ? game.currentCorrectIndex : undefined,
  };
}

export function setupSocketHandlers(io: Server) {
  io.on("connection", (socket: Socket) => {
    console.log(`[Socket] Connected: ${socket.id}`);
    socket.on("disconnect", (reason) => {
      console.log(`[Socket] Disconnected: ${socket.id} reason: ${reason}`);
    });

    socket.on("game:host-join", async ({ joinCode }) => {
      console.log(`[Socket] Host join: ${socket.id} -> ${joinCode}`);
      let game = activeGames.get(joinCode);
      if (!game) {
        // Look up game by joinCode via the lookup collection
        const joinCodeDoc = await uniqueJoinCodesCol().doc(joinCode).get();
        if (!joinCodeDoc.exists) {
          socket.emit("error", { message: "Partita non trovata" });
          return;
        }
        const gameId = joinCodeDoc.data()!.gameId;
        const gameDoc = await gamesCol().doc(gameId).get();
        if (!gameDoc.exists) {
          socket.emit("error", { message: "Partita non trovata" });
          return;
        }
        game = await createActiveGame(joinCode, gameId, gameDoc.data()!.hostId);
      }
      game.hostSocketId = socket.id;
      socket.join(getRoomName(joinCode));
      socket.emit("game:state", getGameState(game));
    });

    socket.on("game:join", async ({ joinCode, teamName, photoUrl }) => {
      console.log(`[Socket] Team join: ${socket.id} -> ${joinCode} team: ${teamName}`);
      const game = activeGames.get(joinCode);
      if (!game) {
        console.log(`[Socket] Game not found for joinCode: ${joinCode}`);
        socket.emit("error", { message: "Partita non trovata" });
        return;
      }
      const existingTeam = Array.from(game.teams.values()).find(t => t.name === teamName);
      if (existingTeam) {
        if (existingTeam.connected) {
          socket.emit("error", { message: "Nome squadra già in uso" });
          return;
        }
        existingTeam.connected = true;
        existingTeam.socketId = socket.id;
        await teamsCol(game.gameId).doc(existingTeam.id).update({ socketId: socket.id });
      } else {
        const teamRef = teamsCol(game.gameId).doc();
        const teamData = {
          name: teamName,
          photoUrl: photoUrl || null,
          socketId: socket.id,
          createdAt: Timestamp.now(),
        };
        await teamRef.set(teamData);

        game.teams.set(teamRef.id, {
          id: teamRef.id,
          name: teamName,
          photoUrl: teamData.photoUrl,
          connected: true,
          socketId: socket.id,
        });
      }

      socket.join(getRoomName(joinCode));
      const joinedTeamId = existingTeam?.id || Array.from(game.teams.values()).find(t => t.socketId === socket.id)?.id;
      (socket as Socket & { teamId?: string; joinCode?: string }).teamId = joinedTeamId;
      (socket as Socket & { joinCode?: string }).joinCode = joinCode;

      const joinedTeam = joinedTeamId ? game.teams.get(joinedTeamId) : undefined;
      if (joinedTeam) {
        const { socketId: _, ...teamInfo } = joinedTeam;
        io.to(getRoomName(joinCode)).emit("team:joined", {
          team: teamInfo,
          teamCount: game.teams.size,
        });
      }
      socket.emit("game:state", getGameState(game));
    });

    socket.on("game:start", async ({ joinCode }) => {
      const game = activeGames.get(joinCode);
      if (!game || game.phase !== "lobby" || game.transitioning) return;
      if (game.teams.size < 1) {
        socket.emit("error", { message: "Serve almeno una squadra" });
        return;
      }

      game.transitioning = true;
      try {
        game.currentQuestionIndex = 1;
        await gamesCol().doc(game.gameId).update({ status: "playing", currentQuestionIndex: 1 });
        await loadAndShowQuestion(io, game);
      } finally {
        game.transitioning = false;
      }
    });

    socket.on("question:next", async ({ joinCode }) => {
      const game = activeGames.get(joinCode);
      if (!game || game.phase !== "results" || game.transitioning) return;

      game.transitioning = true;

      try {
        const isLastQuestion = game.currentQuestionIndex >= game.numQuestions;

        if (isLastQuestion) {
          game.phase = "finished";
          const rankings = await computeOverallRankings(game);
          await gamesCol().doc(game.gameId).update({ status: "finished" });
          io.to(getRoomName(joinCode)).emit("game:finished", { rankings });
          removeActiveGame(joinCode);
          return;
        }

        const nextIndex = game.currentQuestionIndex + 1;
        await loadAndShowQuestion(io, game, nextIndex);
      } finally {
        game.transitioning = false;
      }
    });

    socket.on("answer:submit", async ({ joinCode, gameQuestionId, chosenIndex }) => {
      const game = activeGames.get(joinCode);
      if (!game || game.phase !== "answer") return;

      const extSocket = socket as Socket & { teamId?: string };
      const teamId = extSocket.teamId;
      if (!teamId || game.answeredTeams.has(teamId)) return;

      game.answeredTeams.add(teamId);
      const elapsedMs = Date.now() - game.answerPhaseStart;
      const isCorrect = chosenIndex === game.currentCorrectIndex;
      const score = calculateScore(isCorrect, elapsedMs);

      const answerRef = answersCol(game.gameId).doc();
      await answerRef.set({
        gameQuestionId,
        teamId,
        chosenIndex,
        answeredAt: Timestamp.now(),
        score,
      });

      io.to(getRoomName(joinCode)).emit("answer:received", { teamId });

      // All teams answered? Skip timer and show results immediately
      if (game.answeredTeams.size >= game.teams.size) {
        if (game.timer) {
          clearTimeout(game.timer);
          game.timer = null;
        }
        game.phase = "results";
        const currentQ = game.questionsList[game.currentQuestionIndex - 1];
        const rankings = await computeQuestionRankings(game, currentQ.gameQuestionId);

        const isLastQuestion = game.currentQuestionIndex >= game.numQuestions;

        io.to(getRoomName(joinCode)).emit("question:results", {
          rankings,
          correctIndex: game.currentCorrectIndex,
          isLastQuestion,
        });
      }
    });

    socket.on("game:cancel", async ({ joinCode }) => {
      const game = activeGames.get(joinCode);
      if (!game) return;
      if (game.hostSocketId !== socket.id) return;

      if (game.timer) clearTimeout(game.timer);

      io.to(getRoomName(joinCode)).emit("game:cancelled", {
        message: "La partita è stata annullata dall'host.",
      });

      // Delete game and all subcollections with recursiveDelete, plus joinCode lookup
      await Promise.all([
        db.recursiveDelete(gamesCol().doc(game.gameId)),
        uniqueJoinCodesCol().doc(game.joinCode).delete(),
      ]);

      activeGames.delete(joinCode);
    });

    socket.on("rankings:reveal-all", ({ joinCode }) => {
      const game = activeGames.get(joinCode);
      if (!game) return;
      if (game.hostSocketId !== socket.id) return;
      io.to(getRoomName(joinCode)).emit("rankings:revealed");
    });

    socket.on("time:sync", ({ clientTime }) => {
      socket.emit("time:sync", { clientTime, serverTime: Date.now() });
    });

    socket.on("game:request-state", ({ joinCode }) => {
      const game = activeGames.get(joinCode);
      if (game) {
        socket.emit("game:state", getGameState(game));
      }
    });

    socket.on("disconnect", () => {
      const extSocket = socket as Socket & { teamId?: string; joinCode?: string };
      if (extSocket.joinCode && extSocket.teamId) {
        const game = activeGames.get(extSocket.joinCode);
        if (game) {
          const team = game.teams.get(extSocket.teamId);
          if (team) {
            team.connected = false;
            io.to(getRoomName(extSocket.joinCode)).emit("team:left", {
              teamId: extSocket.teamId,
              teamName: team.name,
            });
          }
        }
      }
    });
  });
}

async function loadAndShowQuestion(io: Server, game: ActiveGame, questionIndex?: number) {
  const idx = questionIndex ?? game.currentQuestionIndex;

  const q = game.questionsList.find(
    (q) => q.position === idx
  );
  if (!q) {
    console.error(`[Game ${game.joinCode}] Question not found for position ${idx}. questionsList has ${game.questionsList.length} items, positions: ${game.questionsList.map(q => q.position).join(",")}`);
    return;
  }

  const questionDoc = await questionsCol().doc(q.questionId).get();
  if (!questionDoc.exists) {
    console.error(`[Game ${game.joinCode}] Question data not found in DB for questionId ${q.questionId}`);
    return;
  }
  const questionData = questionDoc.data()!;

  // Only update state AFTER we confirmed the question exists
  game.currentQuestionIndex = idx;
  game.currentQuestion = {
    gameQuestionId: q.gameQuestionId,
    category: questionData.category ?? "Generale",
    text: questionData.text,
    choices: questionData.choices,
    position: idx,
    totalQuestions: game.numQuestions,
  };
  game.currentCorrectIndex = questionData.correctIndex;
  game.answeredTeams = new Set();

  // Persist progress to DB
  await Promise.all([
    gamesCol().doc(game.gameId).update({ currentQuestionIndex: idx }),
    gameQuestionsCol(game.gameId).doc(q.gameQuestionId).update({ startedAt: Timestamp.now() }),
  ]);

  // Phase 1: Show category for 5 seconds
  game.phase = "category";
  const categoryDeadline = Date.now() + CATEGORY_TIME_MS;
  io.to(getRoomName(game.joinCode)).emit("question:category", {
    category: game.currentQuestion.category,
    questionNumber: game.currentQuestionIndex,
    totalQuestions: game.numQuestions,
    deadline: categoryDeadline,
  });

  game.timer = setTimeout(() => {
    // Phase 2: Show question text for READ_TIME_MS
    game.phase = "read";
    const readDeadline = Date.now() + READ_TIME_MS;
    io.to(getRoomName(game.joinCode)).emit("question:show", {
      question: game.currentQuestion!,
      phase: "read",
      deadline: readDeadline,
    });

      // Phase 3: Answer phase for ANSWER_TIME_MS
      game.timer = setTimeout(() => {
        game.phase = "answer";
        game.answerPhaseStart = Date.now();
        const answerDeadline = Date.now() + ANSWER_TIME_MS;
        io.to(getRoomName(game.joinCode)).emit("question:answer-phase", { deadline: answerDeadline });

        game.timer = setTimeout(async () => {
          game.phase = "results";
          const rankings = await computeQuestionRankings(game, q.gameQuestionId);

          const isLastQuestion = game.currentQuestionIndex >= game.numQuestions;

          io.to(getRoomName(game.joinCode)).emit("question:results", {
            rankings,
            correctIndex: game.currentCorrectIndex,
            isLastQuestion,
          });
        }, ANSWER_TIME_MS);
      }, READ_TIME_MS);
    }, CATEGORY_TIME_MS);
}

async function computeQuestionRankings(game: ActiveGame, gameQuestionId: string): Promise<RankingEntry[]> {
  const teamList = Array.from(game.teams.values());

  // Fetch answers for this question and all answers for the game in parallel
  const [questionAnswersSnap, allAnswersSnap] = await Promise.all([
    answersCol(game.gameId).where("gameQuestionId", "==", gameQuestionId).get(),
    answersCol(game.gameId).get(),
  ]);

  const answerMap = new Map(questionAnswersSnap.docs.map(doc => {
    const a = doc.data();
    return [a.teamId, a];
  }));

  // Compute total scores per team from all answers
  const totalScoreMap = new Map<string, number>();
  for (const doc of allAnswersSnap.docs) {
    const a = doc.data();
    totalScoreMap.set(a.teamId, (totalScoreMap.get(a.teamId) ?? 0) + a.score);
  }

  const rankings: RankingEntry[] = teamList.map(team => {
    const answer = answerMap.get(team.id);
    return {
      teamId: team.id,
      teamName: team.name,
      photoUrl: team.photoUrl,
      questionScore: answer?.score ?? 0,
      totalScore: totalScoreMap.get(team.id) ?? 0,
      isCorrect: answer ? answer.chosenIndex === game.currentCorrectIndex : null,
      chosenIndex: answer?.chosenIndex ?? null,
    };
  });

  rankings.sort((a, b) => b.totalScore - a.totalScore);
  return rankings;
}

async function computeOverallRankings(game: ActiveGame): Promise<RankingEntry[]> {
  const teamList = Array.from(game.teams.values());

  const allAnswersSnap = await answersCol(game.gameId).get();

  const totalScoreMap = new Map<string, number>();
  for (const doc of allAnswersSnap.docs) {
    const a = doc.data();
    totalScoreMap.set(a.teamId, (totalScoreMap.get(a.teamId) ?? 0) + a.score);
  }

  const rankings: RankingEntry[] = teamList.map(team => ({
    teamId: team.id,
    teamName: team.name,
    photoUrl: team.photoUrl,
    questionScore: 0,
    totalScore: totalScoreMap.get(team.id) ?? 0,
    isCorrect: null,
    chosenIndex: null,
  }));

  rankings.sort((a, b) => b.totalScore - a.totalScore);
  return rankings;
}
