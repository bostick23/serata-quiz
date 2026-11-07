import type { EngineQuestion } from "./game-engine";

/** Persisted game as needed by the socket layer (plain data, no Firestore types). */
export interface StoredGame {
  gameId: string;
  hostId: string;
  language: string;
  status: "lobby" | "playing" | "finished" | "cancelled";
  numQuestions: number;
  currentQuestionIndex: number;
  questions: EngineQuestion[];
  teams: Array<{ id: string; name: string; photoUrl: string | null; rejoinToken: string | null }>;
  answers: Array<{ teamId: string; gameQuestionId: string; chosenIndex: number | null; score: number }>;
}

export interface StoredAnswer {
  teamId: string;
  gameQuestionId: string;
  chosenIndex: number;
  score: number;
}

/**
 * Persistence port of the game manager. The in-memory runtime is the source of
 * truth during a game; these writes happen after state transitions and their
 * failures are logged, never allowed to block or crash the game.
 */
export interface GameStore {
  loadByJoinCode(joinCode: string): Promise<StoredGame | null>;
  newTeamId(gameId: string): string;
  createTeam(gameId: string, team: { id: string; name: string; photoUrl: string | null; rejoinToken: string; socketId: string }): Promise<void>;
  updateTeamSocket(gameId: string, teamId: string, socketId: string | null): Promise<void>;
  saveAnswer(gameId: string, answer: StoredAnswer): Promise<void>;
  saveProgress(gameId: string, progress: { currentQuestionIndex: number; gameQuestionId: string }): Promise<void>;
  markFinished(gameId: string): Promise<void>;
  deleteGame(gameId: string, joinCode: string): Promise<void>;
}
