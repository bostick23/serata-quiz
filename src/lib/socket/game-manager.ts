import type { Server, Socket } from "socket.io";
import type { IncomingHttpHeaders } from "http";
import { randomBytes } from "crypto";
import {
  addTeam,
  allTeamsAnswered,
  beginAnswer,
  beginRead,
  createRuntime,
  endAnswerPhase,
  findTeamByName,
  finishGame,
  isLastQuestion,
  recordAnswer,
  restoreScores,
  startQuestion,
  toPublicState,
  toQuestionData,
  toTeamInfo,
  type EngineTeam,
  type GameRuntime,
} from "./game-engine";
import { answerPayloadSchema, joinCodePayloadSchema, joinPayloadSchema, timeSyncPayloadSchema } from "./schemas";
import { ANSWER_TIME_MS, CATEGORY_TIME_MS, READ_TIME_MS } from "./events";
import type { GameStore } from "./game-store";
import type {
  AnswerAck,
  ClientToServerEvents,
  CommandAck,
  HostJoinAck,
  JoinAck,
  ServerToClientEvents,
  SocketData,
} from "@/types/socket-events";

export type GameIO = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type IO = GameIO;
type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

export interface Handshake {
  headers: IncomingHttpHeaders;
  auth: Record<string, unknown>;
}

export interface GameManagerDeps {
  store: GameStore;
  /** Resolves the logged-in user id from the handshake (null for anonymous players). */
  authenticate: (handshake: Handshake) => Promise<string | null>;
  timings?: { categoryMs: number; readMs: number; answerMs: number };
  /** Interval of the abandoned-games sweep; 0 disables the automatic sweep. */
  sweepIntervalMs?: number;
  /** Idle time after which a game with nobody connected is evicted from memory. */
  idleTimeoutMs?: number;
  /** Idle time after which a finished game is evicted from memory. */
  finishedTimeoutMs?: number;
}

export interface GameManager {
  activeGameCount(): number;
  sweep(now?: number): number;
  /** Stops timers and waits (bounded) for pending writes; call before closing the server. */
  shutdown(): Promise<void>;
}

interface ActiveGame {
  joinCode: string;
  gameId: string;
  hostId: string;
  language: string;
  runtime: GameRuntime;
  timer: ReturnType<typeof setTimeout> | null;
  rankingsRevealed: boolean;
  lastActivity: number;
}

const ERROR_GENERIC = "Errore del server, riprova tra qualche secondo.";
const ERROR_NOT_FOUND = "Partita non trovata";
const MESSAGE_REPLACED = "La tua squadra è stata ripresa da un altro dispositivo.";

function roomOf(joinCode: string) {
  return `game:${joinCode}`;
}

/** Every host tab (laptop on the TV, phone in the pocket) joins this room. */
function hostRoomOf(joinCode: string) {
  return `host:${joinCode}`;
}

export function createGameManager(io: IO, deps: GameManagerDeps): GameManager {
  const { store } = deps;
  const timings = deps.timings ?? { categoryMs: CATEGORY_TIME_MS, readMs: READ_TIME_MS, answerMs: ANSWER_TIME_MS };
  const idleTimeoutMs = deps.idleTimeoutMs ?? 2 * 60 * 60 * 1000;
  const finishedTimeoutMs = deps.finishedTimeoutMs ?? 30 * 60 * 1000;

  const activeGames = new Map<string, ActiveGame>();
  const loading = new Map<string, Promise<ActiveGame | null>>();
  const pendingWrites = new Set<Promise<void>>();

  // ---------- helpers ----------

  /** Write-behind: persistence never blocks the game and its failures never crash the process. */
  function persist(label: string, write: () => Promise<void>) {
    const p: Promise<void> = Promise.resolve()
      .then(write)
      .catch(err => console.error(`[Game] Persist failed (${label}):`, err))
      .finally(() => pendingWrites.delete(p));
    pendingWrites.add(p);
  }

  function touch(game: ActiveGame) {
    game.lastActivity = Date.now();
  }

  function stateOf(game: ActiveGame) {
    return { ...toPublicState(game.runtime, game.joinCode, game.language), rankingsRevealed: game.rankingsRevealed };
  }

  function clearTimer(game: ActiveGame) {
    if (game.timer) clearTimeout(game.timer);
    game.timer = null;
  }

  function schedule(game: ActiveGame, ms: number, label: string, fn: () => void) {
    clearTimer(game);
    game.timer = setTimeout(() => {
      game.timer = null;
      try {
        fn();
      } catch (err) {
        console.error(`[Game ${game.joinCode}] Timer "${label}" failed:`, err);
        notifyHost(game, ERROR_GENERIC);
      }
    }, ms);
  }

  function notifyHost(game: ActiveGame, message: string) {
    io.to(hostRoomOf(game.joinCode)).emit("error", { message });
  }

  /** Any connection of the game's host user that joined this game as host may control it. */
  function isHost(socket: GameSocket, game: ActiveGame) {
    return socket.data.role === "host" && socket.data.joinCode === game.joinCode && socket.data.userId === game.hostId;
  }

  function hostConnected(game: ActiveGame) {
    return (io.sockets.adapter.rooms.get(hostRoomOf(game.joinCode))?.size ?? 0) > 0;
  }

  /** Tells a connection that it no longer represents its team, and unbinds it. */
  function evictFromTeam(socket: GameSocket, joinCode: string) {
    socket.emit("team:replaced", { message: MESSAGE_REPLACED });
    socket.leave(roomOf(joinCode));
    socket.data.teamId = undefined;
    socket.data.joinCode = undefined;
    socket.data.role = undefined;
  }

  function isConnected(socketId: string | null) {
    return socketId !== null && io.sockets.sockets.has(socketId);
  }

  /**
   * Wraps an event handler: every error is logged and reported to the client
   * (via ack when the event has one) instead of becoming an unhandled rejection.
   */
  function safe<A extends unknown[]>(socket: GameSocket, event: string, handler: (...args: A) => unknown) {
    return async (...args: A) => {
      try {
        await handler(...args);
      } catch (err) {
        console.error(`[Socket] ${event} failed for ${socket.id}:`, err);
        const ack = args[args.length - 1];
        if (typeof ack === "function") ack({ ok: false, code: "server-error", error: ERROR_GENERIC, reason: "server-error" });
        else socket.emit("error", { message: ERROR_GENERIC });
      }
    };
  }

  // ---------- loading ----------

  async function loadGame(joinCode: string): Promise<ActiveGame | null> {
    const stored = await store.loadByJoinCode(joinCode);
    if (!stored || stored.status === "cancelled") return null;

    const runtime = createRuntime({ numQuestions: stored.questions.length, questions: stored.questions });
    for (const t of stored.teams) {
      addTeam(runtime, {
        id: t.id,
        name: t.name,
        photoUrl: t.photoUrl,
        connected: false,
        socketId: null,
        rejoinToken: t.rejoinToken ?? "",
      });
    }

    if (stored.status === "playing" && stored.currentQuestionIndex > 0) {
      // Timers are lost on restart: resume on the results screen of the current question.
      runtime.currentQuestionIndex = Math.min(stored.currentQuestionIndex, runtime.questions.length);
      runtime.phase = "results";
    } else if (stored.status === "finished") {
      runtime.currentQuestionIndex = runtime.questions.length;
      runtime.phase = "finished";
    }
    restoreScores(runtime, stored.answers);

    return {
      joinCode,
      gameId: stored.gameId,
      hostId: stored.hostId,
      language: stored.language,
      runtime,
      timer: null,
      rankingsRevealed: stored.status === "finished",
      lastActivity: Date.now(),
    };
  }

  /** Returns the in-memory game, loading it once from storage if needed (concurrent callers share the load). */
  async function getOrLoadGame(joinCode: string): Promise<ActiveGame | null> {
    const existing = activeGames.get(joinCode);
    if (existing) return existing;

    let pending = loading.get(joinCode);
    if (!pending) {
      pending = loadGame(joinCode)
        .then(game => {
          if (game && !activeGames.has(joinCode)) activeGames.set(joinCode, game);
          return activeGames.get(joinCode) ?? null;
        })
        .finally(() => loading.delete(joinCode));
      loading.set(joinCode, pending);
    }
    return pending;
  }

  // ---------- game flow ----------

  function showQuestion(game: ActiveGame, index: number): boolean {
    const question = startQuestion(game.runtime, index);
    if (!question) {
      console.error(`[Game ${game.joinCode}] Question at position ${index} not found`);
      notifyHost(game, "Domanda non trovata: impossibile proseguire con la partita.");
      return false;
    }

    persist("progress", () =>
      store.saveProgress(game.gameId, { currentQuestionIndex: index, gameQuestionId: question.gameQuestionId }),
    );

    const room = roomOf(game.joinCode);
    const categoryDeadline = Date.now() + timings.categoryMs;
    game.runtime.deadline = categoryDeadline;
    io.to(room).emit("question:category", {
      category: question.category,
      questionNumber: index,
      totalQuestions: game.runtime.numQuestions,
      deadline: categoryDeadline,
    });

    const stillOn = (phase: GameRuntime["phase"]) =>
      game.runtime.currentQuestionIndex === index && game.runtime.phase === phase && activeGames.get(game.joinCode) === game;

    schedule(game, timings.categoryMs, "read", () => {
      if (!stillOn("category")) return;
      const readDeadline = Date.now() + timings.readMs;
      beginRead(game.runtime, readDeadline);
      io.to(room).emit("question:show", { question: toQuestionData(game.runtime, question), phase: "read", deadline: readDeadline });

      schedule(game, timings.readMs, "answer", () => {
        if (!stillOn("read")) return;
        const now = Date.now();
        const answerDeadline = now + timings.answerMs;
        beginAnswer(game.runtime, now, answerDeadline);
        io.to(room).emit("question:answer-phase", { deadline: answerDeadline });

        schedule(game, timings.answerMs, "results", () => closeAnswers(game, question.gameQuestionId));
      });
    });
    return true;
  }

  function closeAnswers(game: ActiveGame, gameQuestionId: string) {
    const results = endAnswerPhase(game.runtime, gameQuestionId);
    if (!results) return; // already closed (timer vs. last answer) or stale
    clearTimer(game);
    io.to(roomOf(game.joinCode)).emit("question:results", results);
  }

  function detachSocketFromTeam(game: ActiveGame, team: EngineTeam, socketId: string) {
    const old = io.sockets.sockets.get(socketId);
    if (old) evictFromTeam(old, game.joinCode);
    if (team.socketId === socketId) team.socketId = null;
  }

  function releaseSocket(socket: GameSocket) {
    const { teamId, joinCode } = socket.data;
    if (!teamId || !joinCode) return;
    const game = activeGames.get(joinCode);
    const team = game?.runtime.teams.get(teamId);
    socket.data.teamId = undefined;
    socket.data.joinCode = undefined;
    if (!game || !team || team.socketId !== socket.id) return;
    team.connected = false;
    team.socketId = null;
    socket.leave(roomOf(joinCode));
    io.to(roomOf(joinCode)).emit("team:left", { teamId, teamName: team.name });
  }

  function attachTeam(socket: GameSocket, game: ActiveGame, team: EngineTeam) {
    if (team.socketId && team.socketId !== socket.id) detachSocketFromTeam(game, team, team.socketId);

    team.socketId = socket.id;
    team.connected = true;
    socket.data.teamId = team.id;
    socket.data.joinCode = game.joinCode;
    socket.data.role = "team";
    socket.join(roomOf(game.joinCode));

    io.to(roomOf(game.joinCode)).emit("team:joined", { team: toTeamInfo(team), teamCount: game.runtime.teams.size });
  }

  // ---------- connection handling ----------

  io.use(async (socket, next) => {
    try {
      socket.data.userId = await deps.authenticate({ headers: socket.handshake.headers, auth: socket.handshake.auth ?? {} });
    } catch (err) {
      console.error("[Socket] Authentication lookup failed:", err);
      socket.data.userId = null;
    }
    next(); // players are anonymous: never refuse the connection here
  });

  io.on("connection", (socket: GameSocket) => {
    if (socket.recovered) {
      // Connection state recovery restored rooms and socket.data: mark the team online again.
      const { teamId, joinCode } = socket.data;
      const game = joinCode ? activeGames.get(joinCode) : undefined;
      const team = teamId ? game?.runtime.teams.get(teamId) : undefined;
      if (game && team && (team.socketId === null || team.socketId === socket.id)) {
        team.socketId = socket.id;
        team.connected = true;
        touch(game);
        io.to(roomOf(game.joinCode)).emit("team:joined", { team: toTeamInfo(team), teamCount: game.runtime.teams.size });
      } else if (joinCode && teamId) {
        // The team was taken over by another device while this one was away (or the game is gone).
        evictFromTeam(socket, joinCode);
      }
    }

    socket.on("game:host-join", safe(socket, "game:host-join", async (raw: unknown, ack?: unknown) => {
      const reply = (res: HostJoinAck) => {
        if (typeof ack === "function") ack(res);
        else if (!res.ok) socket.emit("error", { message: res.error });
      };
      const parsed = joinCodePayloadSchema.safeParse(raw);
      if (!parsed.success) return reply({ ok: false, code: "invalid", error: ERROR_NOT_FOUND });

      const game = await getOrLoadGame(parsed.data.joinCode);
      if (!game) return reply({ ok: false, code: "not-found", error: ERROR_NOT_FOUND });
      if (!socket.data.userId) return reply({ ok: false, code: "unauthorized", error: "Accesso host non autorizzato: effettua il login." });
      if (socket.data.userId !== game.hostId) return reply({ ok: false, code: "unauthorized", error: "Non sei l'host di questa partita." });

      socket.data.role = "host";
      socket.data.joinCode = game.joinCode;
      socket.join(roomOf(game.joinCode));
      socket.join(hostRoomOf(game.joinCode));
      touch(game);
      reply({ ok: true });
      socket.emit("game:state", stateOf(game));
    }));

    socket.on("game:join", safe(socket, "game:join", async (raw: unknown, ack?: unknown) => {
      const reply = (res: JoinAck) => {
        if (typeof ack === "function") ack(res);
        else if (!res.ok) socket.emit("error", { message: res.error });
      };

      const parsed = joinPayloadSchema.safeParse(raw);
      if (!parsed.success) return reply({ ok: false, code: "invalid", error: "Dati non validi: controlla il nome della squadra." });
      const { joinCode, teamName, photoUrl, rejoinToken } = parsed.data;

      const game = await getOrLoadGame(joinCode);
      if (!game) return reply({ ok: false, code: "not-found", error: ERROR_NOT_FOUND });

      // Everything below is synchronous: no other event can interleave between check and update.
      let team: EngineTeam | undefined;
      let reclaimedByName = false;
      if (rejoinToken) {
        team = Array.from(game.runtime.teams.values()).find(t => t.rejoinToken !== "" && t.rejoinToken === rejoinToken);
      }
      if (!team) {
        const sameName = findTeamByName(game.runtime, teamName);
        if (sameName) {
          // Without the token, a name can only be reclaimed when its team is offline (or by its own socket).
          const takenByOther = sameName.socketId !== socket.id && sameName.connected && isConnected(sameName.socketId);
          if (takenByOther) return reply({ ok: false, code: "name-taken", error: "Nome squadra già in uso" });
          team = sameName;
          reclaimedByName = sameName.socketId !== socket.id;
        }
      }
      // A finished game can still be rejoined (to watch the final ranking), but not by new teams.
      if (!team && game.runtime.phase === "finished") return reply({ ok: false, code: "finished", error: "La partita è terminata." });

      // A socket switching team or game releases its previous team first.
      if (socket.data.teamId && (socket.data.joinCode !== joinCode || socket.data.teamId !== team?.id)) releaseSocket(socket);

      if (team) {
        // Reclaiming by name rotates the token: the previous device can no longer take the team back silently.
        if (!team.rejoinToken || reclaimedByName) team.rejoinToken = randomBytes(16).toString("base64url");
        attachTeam(socket, game, team);
        const reclaimed = team;
        persist("team-connection", () =>
          store.updateTeamConnection(game.gameId, reclaimed.id, { socketId: socket.id, rejoinToken: reclaimed.rejoinToken }),
        );
      } else {
        const created: EngineTeam = {
          id: store.newTeamId(game.gameId),
          name: teamName,
          photoUrl: photoUrl ?? null,
          connected: true,
          socketId: socket.id,
          rejoinToken: randomBytes(16).toString("base64url"),
        };
        addTeam(game.runtime, created);
        attachTeam(socket, game, created);
        persist("team-create", () =>
          store.createTeam(game.gameId, {
            id: created.id,
            name: created.name,
            photoUrl: created.photoUrl,
            rejoinToken: created.rejoinToken,
            socketId: socket.id,
          }),
        );
        team = created;
      }

      touch(game);
      reply({ ok: true, teamId: team.id, teamName: team.name, rejoinToken: team.rejoinToken });
      socket.emit("game:state", stateOf(game));
    }));

    /** Resolves the game for a host command, replying with an error (and a state resync) when refused. */
    function hostCommand(raw: unknown, ack: unknown, expectedPhase: GameRuntime["phase"]): ActiveGame | null {
      const reply = (res: CommandAck) => {
        if (typeof ack === "function") ack(res);
        else if (!res.ok) socket.emit("error", { message: res.error });
      };
      const parsed = joinCodePayloadSchema.safeParse(raw);
      const game = parsed.success ? activeGames.get(parsed.data.joinCode) : undefined;
      if (!game) {
        reply({ ok: false, error: ERROR_NOT_FOUND });
        return null;
      }
      if (!isHost(socket, game)) {
        reply({ ok: false, error: "Solo l'host può comandare la partita." });
        return null;
      }
      if (game.runtime.phase !== expectedPhase) {
        reply({ ok: false, error: "Azione non disponibile in questo momento." });
        socket.emit("game:state", stateOf(game)); // the host UI was out of sync
        return null;
      }
      touch(game);
      reply({ ok: true });
      return game;
    }

    socket.on("game:start", safe(socket, "game:start", (raw: unknown, ack?: unknown) => {
      const parsed = joinCodePayloadSchema.safeParse(raw);
      const candidate = parsed.success ? activeGames.get(parsed.data.joinCode) : undefined;
      if (candidate && isHost(socket, candidate) && candidate.runtime.teams.size < 1) {
        const res: CommandAck = { ok: false, error: "Serve almeno una squadra" };
        if (typeof ack === "function") ack(res);
        else socket.emit("error", { message: res.error });
        return;
      }
      const game = hostCommand(raw, ack, "lobby");
      if (game) showQuestion(game, 1);
    }));

    socket.on("question:next", safe(socket, "question:next", (raw: unknown, ack?: unknown) => {
      const game = hostCommand(raw, ack, "results");
      if (!game) return;

      if (isLastQuestion(game.runtime)) {
        const rankings = finishGame(game.runtime);
        clearTimer(game);
        persist("finish", () => store.markFinished(game.gameId));
        io.to(roomOf(game.joinCode)).emit("game:finished", { rankings });
        return;
      }
      showQuestion(game, game.runtime.currentQuestionIndex + 1);
    }));

    socket.on("answer:submit", safe(socket, "answer:submit", (raw: unknown, ack?: unknown) => {
      const reply = (res: AnswerAck) => {
        if (typeof ack === "function") ack(res);
      };
      const parsed = answerPayloadSchema.safeParse(raw);
      if (!parsed.success) return reply({ ok: false, reason: "invalid-payload" });

      const { joinCode, gameQuestionId, chosenIndex } = parsed.data;
      const game = activeGames.get(joinCode);
      const teamId = socket.data.teamId;
      // Only the connection currently bound to the team may answer for it.
      const team = teamId ? game?.runtime.teams.get(teamId) : undefined;
      if (!game || !teamId || !team || socket.data.joinCode !== joinCode || team.socketId !== socket.id) {
        return reply({ ok: false, reason: "not-joined" });
      }

      const result = recordAnswer(game.runtime, teamId, gameQuestionId, chosenIndex, Date.now());
      if (!result.ok) return reply({ ok: false, reason: result.reason });

      touch(game);
      reply({ ok: true });
      persist("answer", () => store.saveAnswer(game.gameId, { teamId, gameQuestionId, chosenIndex, score: result.answer.score }));
      io.to(roomOf(joinCode)).emit("answer:received", { teamId });

      if (allTeamsAnswered(game.runtime)) closeAnswers(game, gameQuestionId);
    }));

    socket.on("game:cancel", safe(socket, "game:cancel", (raw: unknown) => {
      const parsed = joinCodePayloadSchema.safeParse(raw);
      const game = parsed.success ? activeGames.get(parsed.data.joinCode) : undefined;
      if (!game || !isHost(socket, game)) return;

      clearTimer(game);
      game.runtime.phase = "cancelled";
      activeGames.delete(game.joinCode);
      const room = roomOf(game.joinCode);
      io.to(room).emit("game:cancelled", { message: "La partita è stata annullata dall'host." });
      io.in(room).socketsLeave(room);
      persist("cancel", () => store.deleteGame(game.gameId, game.joinCode));
    }));

    socket.on("rankings:reveal-all", safe(socket, "rankings:reveal-all", (raw: unknown) => {
      const parsed = joinCodePayloadSchema.safeParse(raw);
      const game = parsed.success ? activeGames.get(parsed.data.joinCode) : undefined;
      if (!game || !isHost(socket, game)) return;
      game.rankingsRevealed = true;
      io.to(roomOf(game.joinCode)).emit("rankings:revealed");
    }));

    socket.on("time:sync", safe(socket, "time:sync", (raw: unknown) => {
      const parsed = timeSyncPayloadSchema.safeParse(raw);
      if (parsed.success) socket.emit("time:sync", { clientTime: parsed.data.clientTime, serverTime: Date.now() });
    }));

    socket.on("game:request-state", safe(socket, "game:request-state", (raw: unknown) => {
      const parsed = joinCodePayloadSchema.safeParse(raw);
      const game = parsed.success ? activeGames.get(parsed.data.joinCode) : undefined;
      if (game) socket.emit("game:state", stateOf(game));
    }));

    socket.on("disconnect", () => {
      try {
        const { joinCode } = socket.data;
        const game = joinCode ? activeGames.get(joinCode) : undefined;
        if (game) touch(game);

        const teamId = socket.data.teamId;
        const team = teamId ? game?.runtime.teams.get(teamId) : undefined;
        // Only the socket currently bound to the team may mark it offline (ignore late disconnects of replaced sockets).
        if (game && team && team.socketId === socket.id) {
          team.connected = false;
          io.to(roomOf(game.joinCode)).emit("team:left", { teamId: team.id, teamName: team.name });
        }
      } catch (err) {
        console.error(`[Socket] disconnect handling failed for ${socket.id}:`, err);
      }
    });
  });

  // ---------- maintenance ----------

  function sweep(now = Date.now()): number {
    let removed = 0;
    for (const [joinCode, game] of activeGames) {
      const someoneConnected =
        hostConnected(game) ||
        Array.from(game.runtime.teams.values()).some(t => t.connected && isConnected(t.socketId));
      const timeout = game.runtime.phase === "finished" ? finishedTimeoutMs : idleTimeoutMs;
      if (!someoneConnected && now - game.lastActivity > timeout) {
        clearTimer(game);
        activeGames.delete(joinCode);
        removed++;
      }
    }
    if (removed > 0) console.log(`[Game] Swept ${removed} idle game(s); ${activeGames.size} still active`);
    return removed;
  }

  const sweepIntervalMs = deps.sweepIntervalMs ?? 10 * 60 * 1000;
  const sweepTimer = sweepIntervalMs > 0 ? setInterval(() => sweep(), sweepIntervalMs) : null;
  sweepTimer?.unref();

  return {
    activeGameCount: () => activeGames.size,
    sweep,
    async shutdown() {
      if (sweepTimer) clearInterval(sweepTimer);
      for (const game of activeGames.values()) clearTimer(game);
      const flush = Promise.allSettled([...pendingWrites]);
      await Promise.race([flush, new Promise(resolve => setTimeout(resolve, 5_000).unref())]);
    },
  };
}
