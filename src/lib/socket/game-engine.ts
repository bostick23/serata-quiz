/**
 * Pure, synchronous game state machine.
 *
 * Everything that decides "what happens in the game" lives here, with no
 * Firestore or Socket.io dependency, so it can be unit-tested and so state
 * transitions never interleave with `await`s (which caused double results and
 * inconsistent scores when the timer and the last answer arrived together).
 * Persistence is the caller's job and happens after the in-memory transition.
 */
import { calculateScore } from "./scoring";
import type { GamePhase, GameState, QuestionData, RankingEntry, TeamInfo } from "@/types/game";

export interface EngineQuestion {
  gameQuestionId: string;
  questionId: string;
  position: number;
  category: string;
  text: string;
  choices: string[];
  correctIndex: number;
}

export interface EngineTeam extends TeamInfo {
  socketId: string | null;
  rejoinToken: string;
}

export interface AnswerRecord {
  chosenIndex: number;
  score: number;
}

export interface GameRuntime {
  phase: GamePhase;
  /** 1-based position of the current question; 0 before the game starts. */
  currentQuestionIndex: number;
  numQuestions: number;
  /** Sorted by position. */
  questions: EngineQuestion[];
  teams: Map<string, EngineTeam>;
  /** Running total per team: the source of truth for rankings. */
  scores: Map<string, number>;
  /** Answers to the current question only. */
  currentAnswers: Map<string, AnswerRecord>;
  answerPhaseStart: number;
  /** Server-clock deadline of the current timed phase, if any. */
  deadline: number | null;
  lastRankings: RankingEntry[] | null;
}

export type AnswerRejection =
  | "wrong-phase"
  | "stale-question"
  | "unknown-team"
  | "already-answered"
  | "invalid-choice";

export type AnswerResult =
  | { ok: true; answer: AnswerRecord; gameQuestionId: string }
  | { ok: false; reason: AnswerRejection };

export interface QuestionResults {
  rankings: RankingEntry[];
  correctIndex: number;
  isLastQuestion: boolean;
  nextCategory: string | null;
}

export function createRuntime(init: { numQuestions: number; questions: EngineQuestion[] }): GameRuntime {
  return {
    phase: "lobby",
    currentQuestionIndex: 0,
    numQuestions: init.numQuestions,
    questions: [...init.questions].sort((a, b) => a.position - b.position),
    teams: new Map(),
    scores: new Map(),
    currentAnswers: new Map(),
    answerPhaseStart: 0,
    deadline: null,
    lastRankings: null,
  };
}

export function normalizeTeamName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

function teamNameKey(name: string): string {
  return normalizeTeamName(name).toLocaleLowerCase("it-IT");
}

export function findTeamByName(game: GameRuntime, name: string): EngineTeam | undefined {
  const key = teamNameKey(name);
  for (const team of game.teams.values()) {
    if (teamNameKey(team.name) === key) return team;
  }
  return undefined;
}

export function addTeam(game: GameRuntime, team: EngineTeam): void {
  game.teams.set(team.id, team);
  if (!game.scores.has(team.id)) game.scores.set(team.id, 0);
}

export function getCurrentQuestion(game: GameRuntime): EngineQuestion | null {
  return game.questions.find(q => q.position === game.currentQuestionIndex) ?? null;
}

/** Moves to the category phase of question `index`. Returns null (state untouched) if it does not exist. */
export function startQuestion(game: GameRuntime, index: number): EngineQuestion | null {
  const question = game.questions.find(q => q.position === index);
  if (!question) return null;

  game.currentQuestionIndex = index;
  game.currentAnswers = new Map();
  game.lastRankings = null;
  game.phase = "category";
  return question;
}

export function beginRead(game: GameRuntime, deadline: number): void {
  game.phase = "read";
  game.deadline = deadline;
}

export function beginAnswer(game: GameRuntime, now: number, deadline: number = now): void {
  game.phase = "answer";
  game.answerPhaseStart = now;
  game.deadline = deadline;
}

export function recordAnswer(
  game: GameRuntime,
  teamId: string,
  gameQuestionId: string,
  chosenIndex: number,
  now: number,
): AnswerResult {
  if (game.phase !== "answer") return { ok: false, reason: "wrong-phase" };

  const question = getCurrentQuestion(game);
  if (!question || question.gameQuestionId !== gameQuestionId) return { ok: false, reason: "stale-question" };
  if (!game.teams.has(teamId)) return { ok: false, reason: "unknown-team" };
  if (game.currentAnswers.has(teamId)) return { ok: false, reason: "already-answered" };
  if (!Number.isInteger(chosenIndex) || chosenIndex < 0 || chosenIndex >= question.choices.length) {
    return { ok: false, reason: "invalid-choice" };
  }

  const isCorrect = chosenIndex === question.correctIndex;
  const answer: AnswerRecord = { chosenIndex, score: calculateScore(isCorrect, now - game.answerPhaseStart) };
  game.currentAnswers.set(teamId, answer);
  game.scores.set(teamId, (game.scores.get(teamId) ?? 0) + answer.score);
  return { ok: true, answer, gameQuestionId };
}

export function allTeamsAnswered(game: GameRuntime): boolean {
  return game.teams.size > 0 && game.currentAnswers.size >= game.teams.size;
}

function sortByTotal(rankings: RankingEntry[]): RankingEntry[] {
  return rankings.sort((a, b) => b.totalScore - a.totalScore);
}

function computeQuestionRankings(game: GameRuntime, correctIndex: number): RankingEntry[] {
  return sortByTotal(
    Array.from(game.teams.values()).map(team => {
      const answer = game.currentAnswers.get(team.id);
      return {
        teamId: team.id,
        teamName: team.name,
        questionScore: answer?.score ?? 0,
        totalScore: game.scores.get(team.id) ?? 0,
        isCorrect: answer ? answer.chosenIndex === correctIndex : null,
        chosenIndex: answer?.chosenIndex ?? null,
      };
    }),
  );
}

/**
 * Closes the answer phase of `gameQuestionId`. Idempotent: returns null if the
 * phase was already closed or the call refers to another question (stale timer).
 */
export function endAnswerPhase(game: GameRuntime, gameQuestionId: string): QuestionResults | null {
  if (game.phase !== "answer") return null;
  const question = getCurrentQuestion(game);
  if (!question || question.gameQuestionId !== gameQuestionId) return null;

  game.phase = "results";
  game.deadline = null;
  const rankings = computeQuestionRankings(game, question.correctIndex);
  game.lastRankings = rankings;

  const next = game.questions.find(q => q.position === game.currentQuestionIndex + 1);
  return {
    rankings,
    correctIndex: question.correctIndex,
    isLastQuestion: isLastQuestion(game),
    nextCategory: next?.category ?? null,
  };
}

export function isLastQuestion(game: GameRuntime): boolean {
  return game.currentQuestionIndex >= game.numQuestions;
}

export function computeFinalRankings(game: GameRuntime): RankingEntry[] {
  return sortByTotal(
    Array.from(game.teams.values()).map(team => ({
      teamId: team.id,
      teamName: team.name,
      questionScore: 0,
      totalScore: game.scores.get(team.id) ?? 0,
      isCorrect: null,
      chosenIndex: null,
    })),
  );
}

export function finishGame(game: GameRuntime): RankingEntry[] {
  game.phase = "finished";
  game.deadline = null;
  game.lastRankings = computeFinalRankings(game);
  return game.lastRankings;
}

/** Rebuilds running totals (and the current question's answers) from persisted answers. */
export function restoreScores(
  game: GameRuntime,
  answers: Array<{ teamId: string; gameQuestionId: string; chosenIndex: number | null; score: number }>,
): void {
  const currentId = getCurrentQuestion(game)?.gameQuestionId;
  game.scores = new Map(Array.from(game.teams.keys(), id => [id, 0]));
  game.currentAnswers = new Map();

  for (const a of answers) {
    game.scores.set(a.teamId, (game.scores.get(a.teamId) ?? 0) + a.score);
    if (a.gameQuestionId === currentId && a.chosenIndex !== null) {
      game.currentAnswers.set(a.teamId, { chosenIndex: a.chosenIndex, score: a.score });
    }
  }

  if (game.phase === "results") {
    const question = getCurrentQuestion(game);
    if (question) game.lastRankings = computeQuestionRankings(game, question.correctIndex);
  } else if (game.phase === "finished") {
    game.lastRankings = computeFinalRankings(game);
  }
}

export function toQuestionData(game: GameRuntime, q: EngineQuestion): QuestionData {
  return {
    gameQuestionId: q.gameQuestionId,
    category: q.category,
    text: q.text,
    choices: q.choices,
    position: q.position,
    totalQuestions: game.numQuestions,
  };
}

export function toTeamInfo(team: EngineTeam): TeamInfo {
  return { id: team.id, name: team.name, photoUrl: team.photoUrl, connected: team.connected };
}

/** Snapshot sent to (re)connecting clients. Never includes secrets or the answer before results. */
export function toPublicState(game: GameRuntime, joinCode: string, language: string): GameState {
  const inQuestion = game.phase === "category" || game.phase === "read" || game.phase === "answer" || game.phase === "results";
  const question = inQuestion ? getCurrentQuestion(game) : null;
  const showResults = game.phase === "results" && question !== null;
  const finished = game.phase === "finished";

  return {
    joinCode,
    phase: game.phase,
    language,
    currentQuestion: game.currentQuestionIndex,
    numQuestions: game.numQuestions,
    teams: Array.from(game.teams.values(), toTeamInfo),
    question: question ? toQuestionData(game, question) : undefined,
    categoryName: question?.category,
    deadline: game.deadline ?? undefined,
    correctIndex: showResults ? question.correctIndex : undefined,
    rankings: showResults || finished ? game.lastRankings ?? undefined : undefined,
    isLastQuestion: showResults ? isLastQuestion(game) : undefined,
    answeredTeamIds: game.phase === "answer" ? Array.from(game.currentAnswers.keys()) : undefined,
  };
}
