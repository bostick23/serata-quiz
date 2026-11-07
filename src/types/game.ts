export type GamePhase = "lobby" | "category" | "read" | "answer" | "results" | "finished" | "cancelled";

export interface TeamInfo {
  id: string;
  name: string;
  photoUrl: string | null;
  connected: boolean;
}

export interface QuestionData {
  gameQuestionId: string;
  category: string;
  text: string;
  choices: string[];
  position: number;
  totalQuestions: number;
}

export interface RankingEntry {
  teamId: string;
  teamName: string;
  /** @deprecated photos are sent once with the team list; resolve them by teamId. */
  photoUrl?: string | null;
  questionScore: number;
  totalScore: number;
  isCorrect: boolean | null;
  chosenIndex: number | null;
}

export interface GameState {
  joinCode: string;
  phase: GamePhase;
  language: string;
  currentQuestion: number;
  numQuestions: number;
  teams: TeamInfo[];
  question?: QuestionData;
  deadline?: number;
  rankings?: RankingEntry[];
  correctIndex?: number;
  isLastQuestion?: boolean;
  categoryName?: string;
  /** Teams that already answered the current question (answer phase only). */
  answeredTeamIds?: string[];
}
