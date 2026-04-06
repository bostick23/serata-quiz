import { Server, Socket } from "socket.io";
import { eq, and, sql, isNull, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { games, gameQuestions, questions, teams, answers } from "@/lib/db/schema";
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
  const [game] = await db.select().from(games).where(eq(games.id, gameId));

  const questionRows = await db
    .select({
      gameQuestionId: gameQuestions.id,
      questionId: gameQuestions.questionId,
      position: gameQuestions.position,
    })
    .from(gameQuestions)
    .where(eq(gameQuestions.gameId, gameId))
    .orderBy(gameQuestions.position);

  const existingTeams = await db.select().from(teams).where(eq(teams.gameId, gameId));

  // Determine phase from DB status and currentQuestionIndex
  let phase: GamePhase = "lobby";
  if (game.status === "playing") {
    // Game was in progress — restore to results so host can click "next"
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

  for (const t of existingTeams) {
    activeGame.teams.set(t.id, {
      id: t.id,
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
        const [dbGame] = await db.select().from(games).where(eq(games.joinCode, joinCode));
        if (!dbGame) {
          socket.emit("error", { message: "Partita non trovata" });
          return;
        }
        game = await createActiveGame(joinCode, dbGame.id, dbGame.hostId);
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
        await db.update(teams).set({ socketId: socket.id }).where(eq(teams.id, existingTeam.id));
      } else {
        const [newTeam] = await db
          .insert(teams)
          .values({ gameId: game.gameId, name: teamName, photoUrl: photoUrl || null, socketId: socket.id })
          .returning();

        game.teams.set(newTeam.id, {
          id: newTeam.id,
          name: newTeam.name,
          photoUrl: newTeam.photoUrl,
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
        await db.update(games).set({ status: "playing", currentQuestionIndex: 1 }).where(eq(games.id, game.gameId));
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
          // Last question -> finish game
          game.phase = "finished";
          const rankings = await computeOverallRankings(game);
          await db.update(games).set({ status: "finished" }).where(eq(games.id, game.gameId));
          io.to(getRoomName(joinCode)).emit("game:finished", { rankings });
          removeActiveGame(joinCode);
          return;
        }

        // Advance to next question — index and phase change happen inside loadAndShowQuestion
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

      await db.insert(answers).values({
        gameQuestionId,
        teamId,
        chosenIndex,
        answeredAt: new Date(),
        score,
      }).onConflictDoNothing();

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
      // Only the host can cancel
      if (game.hostSocketId !== socket.id) return;

      // Clear any running timers
      if (game.timer) clearTimeout(game.timer);

      // Notify all clients in the room before cleanup
      io.to(getRoomName(joinCode)).emit("game:cancelled", {
        message: "La partita è stata annullata dall'host.",
      });

      // Delete from DB (order matters: answers → teams + gameQuestions → game)
      const teamIds = await db.select({ id: teams.id }).from(teams).where(eq(teams.gameId, game.gameId));
      if (teamIds.length > 0) {
        const gqIds = await db.select({ id: gameQuestions.id }).from(gameQuestions).where(eq(gameQuestions.gameId, game.gameId));
        if (gqIds.length > 0) {
          for (const gq of gqIds) {
            await db.delete(answers).where(eq(answers.gameQuestionId, gq.id));
          }
        }
        await db.delete(teams).where(eq(teams.gameId, game.gameId));
      }
      await db.delete(gameQuestions).where(eq(gameQuestions.gameId, game.gameId));
      await db.delete(games).where(eq(games.id, game.gameId));

      // Remove from active games
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

  const [questionData] = await db.select().from(questions).where(eq(questions.id, q.questionId));
  if (!questionData) {
    console.error(`[Game ${game.joinCode}] Question data not found in DB for questionId ${q.questionId}`);
    return;
  }

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

  // Persist progress to DB so server restarts don't lose it
  await db.update(games).set({ currentQuestionIndex: idx }).where(eq(games.id, game.gameId));
  await db.update(gameQuestions).set({ startedAt: new Date() }).where(eq(gameQuestions.id, q.gameQuestionId));

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
  const answerRows = await db
    .select()
    .from(answers)
    .where(eq(answers.gameQuestionId, gameQuestionId));

  const answerMap = new Map(answerRows.map(a => [a.teamId, a]));

  const allAnswers = await db
    .select({
      teamId: answers.teamId,
      totalScore: sql<number>`sum(${answers.score})::int`,
    })
    .from(answers)
    .innerJoin(gameQuestions, eq(answers.gameQuestionId, gameQuestions.id))
    .where(eq(gameQuestions.gameId, game.gameId))
    .groupBy(answers.teamId);

  const totalScoreMap = new Map(allAnswers.map(a => [a.teamId, a.totalScore]));

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

  const allAnswers = await db
    .select({
      teamId: answers.teamId,
      totalScore: sql<number>`sum(${answers.score})::int`,
    })
    .from(answers)
    .innerJoin(gameQuestions, eq(answers.gameQuestionId, gameQuestions.id))
    .where(eq(gameQuestions.gameId, game.gameId))
    .groupBy(answers.teamId);

  const totalScoreMap = new Map(allAnswers.map(a => [a.teamId, a.totalScore]));

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
