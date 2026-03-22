import { Server, Socket } from "socket.io";
import { eq, and, sql, isNull, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { games, gameQuestions, questions, teams, answers } from "@/lib/db/schema";
import { calculateScore } from "./scoring";
import { READ_TIME_MS, ANSWER_TIME_MS } from "./events";
import type { GamePhase, QuestionData, RankingEntry, TeamInfo } from "@/types/game";

interface ActiveGame {
  joinCode: string;
  gameId: string;
  hostId: string;
  hostSocketId: string | null;
  phase: GamePhase;
  currentRound: number;
  currentQuestionIndex: number;
  totalRounds: number;
  questionsPerRound: number;
  teams: Map<string, TeamInfo & { socketId: string }>;
  currentQuestion: QuestionData | null;
  currentCorrectIndex: number;
  answerPhaseStart: number;
  answeredTeams: Set<string>;
  questionsList: Array<{ gameQuestionId: string; questionId: string; roundNumber: number; position: number }>;
  timer: ReturnType<typeof setTimeout> | null;
  revealedPositions: number;
  roundRankings: RankingEntry[];
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
      roundNumber: gameQuestions.roundNumber,
      position: gameQuestions.position,
    })
    .from(gameQuestions)
    .where(eq(gameQuestions.gameId, gameId))
    .orderBy(gameQuestions.roundNumber, gameQuestions.position);

  const existingTeams = await db.select().from(teams).where(eq(teams.gameId, gameId));

  const activeGame: ActiveGame = {
    joinCode,
    gameId,
    hostId,
    hostSocketId: null,
    phase: "lobby",
    currentRound: 0,
    currentQuestionIndex: 0,
    totalRounds: game.numRounds,
    questionsPerRound: game.questionsPerRound,
    teams: new Map(),
    currentQuestion: null,
    currentCorrectIndex: -1,
    answerPhaseStart: 0,
    answeredTeams: new Set(),
    questionsList: questionRows,
    timer: null,
    revealedPositions: 0,
    roundRankings: [],
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
    currentRound: game.currentRound,
    currentQuestion: game.currentQuestionIndex,
    totalRounds: game.totalRounds,
    questionsPerRound: game.questionsPerRound,
    teams: Array.from(game.teams.values()).map(({ socketId, ...rest }) => rest),
    question: game.currentQuestion ?? undefined,
    correctIndex: game.phase === "results" || game.phase === "round-end" ? game.currentCorrectIndex : undefined,
    rankings: game.roundRankings.length > 0 ? game.roundRankings : undefined,
    revealedPositions: game.revealedPositions,
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
      if (game.phase !== "lobby") {
        socket.emit("error", { message: "La partita è già iniziata" });
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
      if (!game || game.phase !== "lobby") return;
      if (game.teams.size < 1) {
        socket.emit("error", { message: "Serve almeno una squadra" });
        return;
      }

      game.phase = "read";
      game.currentRound = 1;
      game.currentQuestionIndex = 1;

      await db.update(games).set({ status: "playing", currentRound: 1, currentQuestionIndex: 1 }).where(eq(games.id, game.gameId));

      await loadAndShowQuestion(io, game);
    });

    socket.on("question:next", async ({ joinCode }) => {
      const game = activeGames.get(joinCode);
      if (!game || (game.phase !== "results" && game.phase !== "round-end")) return;

      const currentRoundQuestions = game.questionsList.filter(q => q.roundNumber === game.currentRound);
      const isLastQuestionInRound = game.currentQuestionIndex >= currentRoundQuestions.length;

      if (isLastQuestionInRound) {
        if (game.currentRound >= game.totalRounds) {
          game.phase = "finished";
          const rankings = await computeOverallRankings(game);
          game.roundRankings = rankings;
          await db.update(games).set({ status: "finished" }).where(eq(games.id, game.gameId));
          io.to(getRoomName(joinCode)).emit("game:finished", { rankings });
          removeActiveGame(joinCode);
          return;
        }
        game.currentRound++;
        game.currentQuestionIndex = 1;
      } else {
        game.currentQuestionIndex++;
      }

      game.phase = "read";
      await loadAndShowQuestion(io, game);
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
    });

    socket.on("reveal:next", async ({ joinCode }) => {
      const game = activeGames.get(joinCode);
      if (!game || game.phase !== "round-end") return;

      if (game.revealedPositions < game.roundRankings.length) {
        const idx = game.roundRankings.length - 1 - game.revealedPositions;
        game.revealedPositions++;
        io.to(getRoomName(joinCode)).emit("reveal:position", {
          position: game.revealedPositions,
          entry: game.roundRankings[idx],
        });
      }

      if (game.revealedPositions >= game.roundRankings.length) {
        if (game.currentRound >= game.totalRounds) {
          game.phase = "finished";
          await db.update(games).set({ status: "finished" }).where(eq(games.id, game.gameId));
          io.to(getRoomName(joinCode)).emit("game:finished", { rankings: game.roundRankings });
          removeActiveGame(joinCode);
        }
      }
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

async function loadAndShowQuestion(io: Server, game: ActiveGame) {
  const q = game.questionsList.find(
    (q) => q.roundNumber === game.currentRound && q.position === game.currentQuestionIndex
  );
  if (!q) return;

  const [questionData] = await db.select().from(questions).where(eq(questions.id, q.questionId));
  if (!questionData) return;

  const roundQuestions = game.questionsList.filter(qq => qq.roundNumber === game.currentRound);

  game.currentQuestion = {
    gameQuestionId: q.gameQuestionId,
    text: questionData.text,
    choices: questionData.choices,
    roundNumber: game.currentRound,
    position: game.currentQuestionIndex,
    totalQuestions: roundQuestions.length,
  };
  game.currentCorrectIndex = questionData.correctIndex;
  game.answeredTeams = new Set();

  await db.update(gameQuestions).set({ startedAt: new Date() }).where(eq(gameQuestions.id, q.gameQuestionId));

  const readDeadline = Date.now() + READ_TIME_MS;
  io.to(getRoomName(game.joinCode)).emit("question:show", {
    question: game.currentQuestion,
    phase: "read",
    deadline: readDeadline,
  });

  game.timer = setTimeout(() => {
    game.phase = "answer";
    game.answerPhaseStart = Date.now();
    const answerDeadline = Date.now() + ANSWER_TIME_MS;
    io.to(getRoomName(game.joinCode)).emit("question:answer-phase", { deadline: answerDeadline });

    game.timer = setTimeout(async () => {
      game.phase = "results";
      const rankings = await computeQuestionRankings(game, q.gameQuestionId);

      io.to(getRoomName(game.joinCode)).emit("question:results", {
        rankings,
        correctIndex: game.currentCorrectIndex,
      });

      const currentRoundQuestions = game.questionsList.filter(qq => qq.roundNumber === game.currentRound);
      const isLastQuestion = game.currentQuestionIndex >= currentRoundQuestions.length;

      if (isLastQuestion) {
        game.phase = "round-end";
        const overallRankings = await computeOverallRankings(game);
        game.roundRankings = overallRankings;
        game.revealedPositions = 0;
        io.to(getRoomName(game.joinCode)).emit("round:end", {
          round: game.currentRound,
          rankings: overallRankings,
        });
      }
    }, ANSWER_TIME_MS);
  }, READ_TIME_MS);
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
  }));

  rankings.sort((a, b) => b.totalScore - a.totalScore);
  return rankings;
}
