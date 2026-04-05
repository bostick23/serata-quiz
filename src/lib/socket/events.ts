export const EVENTS = {
  // Client -> Server
  HOST_JOIN: "game:host-join",
  PLAYER_JOIN: "game:join",
  GAME_START: "game:start",
  QUESTION_NEXT: "question:next",
  ANSWER_SUBMIT: "answer:submit",
  REQUEST_STATE: "game:request-state",

  // Server -> Client
  TEAM_JOINED: "team:joined",
  TEAM_LEFT: "team:left",
  GAME_STARTED: "game:started",
  GAME_STATE: "game:state",
  QUESTION_SHOW: "question:show",
  QUESTION_ANSWER_PHASE: "question:answer-phase",
  ANSWER_RECEIVED: "answer:received",
  QUESTION_RESULTS: "question:results",
  GAME_FINISHED: "game:finished",
  ERROR: "error",
} as const;

export const CATEGORY_TIME_MS = 5000;
export const READ_TIME_MS = 7000;
export const ANSWER_TIME_MS = 10000;
