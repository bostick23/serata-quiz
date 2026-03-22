import { GameState, QuestionData, RankingEntry, TeamInfo } from "./game";

export interface ServerToClientEvents {
  "team:joined": (data: { team: TeamInfo; teamCount: number }) => void;
  "team:left": (data: { teamId: string; teamName: string }) => void;
  "game:started": (data: { totalRounds: number; questionsPerRound: number }) => void;
  "game:state": (data: GameState) => void;
  "question:show": (data: { question: QuestionData; phase: "read"; deadline: number }) => void;
  "question:answer-phase": (data: { deadline: number }) => void;
  "answer:received": (data: { teamId: string }) => void;
  "question:results": (data: { rankings: RankingEntry[]; correctIndex: number }) => void;
  "round:end": (data: { round: number; rankings: RankingEntry[] }) => void;
  "reveal:position": (data: { position: number; entry: RankingEntry }) => void;
  "game:finished": (data: { rankings: RankingEntry[] }) => void;
  "game:cancelled": (data: { message: string }) => void;
  "error": (data: { message: string }) => void;
}

export interface ClientToServerEvents {
  "game:host-join": (data: { joinCode: string }) => void;
  "game:join": (data: { joinCode: string; teamName: string; photoUrl?: string }) => void;
  "game:start": (data: { joinCode: string }) => void;
  "question:next": (data: { joinCode: string }) => void;
  "answer:submit": (data: { joinCode: string; gameQuestionId: string; chosenIndex: number }) => void;
  "reveal:next": (data: { joinCode: string }) => void;
  "game:cancel": (data: { joinCode: string }) => void;
  "game:request-state": (data: { joinCode: string }) => void;
}
