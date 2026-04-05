import { GameState, QuestionData, RankingEntry, TeamInfo } from "./game";

export interface ServerToClientEvents {
  "team:joined": (data: { team: TeamInfo; teamCount: number }) => void;
  "team:left": (data: { teamId: string; teamName: string }) => void;
  "game:started": (data: { numQuestions: number }) => void;
  "game:state": (data: GameState) => void;
  "question:category": (data: { category: string; questionNumber: number; totalQuestions: number; deadline: number }) => void;
  "question:show": (data: { question: QuestionData; phase: "read"; deadline: number }) => void;
  "question:answer-phase": (data: { deadline: number }) => void;
  "answer:received": (data: { teamId: string }) => void;
  "question:results": (data: { rankings: RankingEntry[]; correctIndex: number; isLastQuestion: boolean }) => void;
  "game:finished": (data: { rankings: RankingEntry[] }) => void;
  "rankings:revealed": () => void;
  "game:cancelled": (data: { message: string }) => void;
  "error": (data: { message: string }) => void;
}

export interface ClientToServerEvents {
  "game:host-join": (data: { joinCode: string }) => void;
  "game:join": (data: { joinCode: string; teamName: string; photoUrl?: string }) => void;
  "game:start": (data: { joinCode: string }) => void;
  "question:next": (data: { joinCode: string }) => void;
  "answer:submit": (data: { joinCode: string; gameQuestionId: string; chosenIndex: number }) => void;
  "game:cancel": (data: { joinCode: string }) => void;
  "rankings:reveal-all": (data: { joinCode: string }) => void;
  "game:request-state": (data: { joinCode: string }) => void;
}
