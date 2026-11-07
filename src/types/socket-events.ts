import { GameState, QuestionData, RankingEntry, TeamInfo } from "./game";

export type JoinErrorCode = "invalid" | "not-found" | "finished" | "name-taken" | "server-error";

export type JoinAck =
  | { ok: true; teamId: string; teamName: string; rejoinToken: string }
  | { ok: false; error: string; code: JoinErrorCode };

export type AnswerAck = { ok: true } | { ok: false; reason: string };

export type HostJoinAck = { ok: true } | { ok: false; error: string; code: "invalid" | "not-found" | "unauthorized" | "server-error" };

/** Reply to host commands, so the host UI can re-enable its buttons when a command is refused. */
export type CommandAck = { ok: true } | { ok: false; error: string };

export interface ServerToClientEvents {
  "team:joined": (data: { team: TeamInfo; teamCount: number }) => void;
  "team:left": (data: { teamId: string; teamName: string }) => void;
  /** Sent to a connection whose team was taken over by another device. */
  "team:replaced": (data: { message: string }) => void;
  "game:state": (data: GameState & { rankingsRevealed?: boolean }) => void;
  "question:category": (data: { category: string; questionNumber: number; totalQuestions: number; deadline: number }) => void;
  "question:show": (data: { question: QuestionData; phase: "read"; deadline: number }) => void;
  "question:answer-phase": (data: { deadline: number }) => void;
  "answer:received": (data: { teamId: string }) => void;
  "question:results": (data: { rankings: RankingEntry[]; correctIndex: number; isLastQuestion: boolean; nextCategory: string | null }) => void;
  "game:finished": (data: { rankings: RankingEntry[] }) => void;
  "rankings:revealed": () => void;
  "game:cancelled": (data: { message: string }) => void;
  "time:sync": (data: { clientTime: number; serverTime: number }) => void;
  "error": (data: { message: string }) => void;
}

export interface ClientToServerEvents {
  "game:host-join": (data: { joinCode: string }, ack: (res: HostJoinAck) => void) => void;
  "game:join": (
    data: { joinCode: string; teamName: string; photoUrl?: string | null; rejoinToken?: string | null },
    ack: (res: JoinAck) => void,
  ) => void;
  "game:start": (data: { joinCode: string }, ack: (res: CommandAck) => void) => void;
  "question:next": (data: { joinCode: string }, ack: (res: CommandAck) => void) => void;
  "answer:submit": (data: { joinCode: string; gameQuestionId: string; chosenIndex: number }, ack: (res: AnswerAck) => void) => void;
  "game:cancel": (data: { joinCode: string }) => void;
  "rankings:reveal-all": (data: { joinCode: string }) => void;
  "time:sync": (data: { clientTime: number }) => void;
  "game:request-state": (data: { joinCode: string }) => void;
}

/** Per-socket data; survives Socket.io connection state recovery (unlike ad-hoc socket properties). */
export interface SocketData {
  userId?: string | null;
  teamId?: string;
  joinCode?: string;
  role?: "host" | "team";
}
