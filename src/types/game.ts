export type GamePhase = "lobby" | "read" | "answer" | "results" | "round-end" | "finished" | "cancelled";

export interface TeamInfo {
  id: string;
  name: string;
  photoUrl: string | null;
  connected: boolean;
}

export interface QuestionData {
  gameQuestionId: string;
  text: string;
  choices: string[];
  roundNumber: number;
  position: number;
  totalQuestions: number;
}

export interface RankingEntry {
  teamId: string;
  teamName: string;
  photoUrl: string | null;
  questionScore: number;
  totalScore: number;
  isCorrect: boolean | null;
}

export interface GameState {
  joinCode: string;
  phase: GamePhase;
  currentRound: number;
  currentQuestion: number;
  totalRounds: number;
  questionsPerRound: number;
  teams: TeamInfo[];
  question?: QuestionData;
  deadline?: number;
  rankings?: RankingEntry[];
  correctIndex?: number;
  revealedPositions?: number;
}
