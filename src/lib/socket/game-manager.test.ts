import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createServer, type Server as HttpServer } from "http";
import type { AddressInfo } from "net";
import { Server } from "socket.io";
import { io as connect, type Socket as ClientSocket } from "socket.io-client";
import { createGameManager, type GameIO, type GameManager } from "./game-manager";
import type { GameStore, StoredGame, StoredAnswer } from "./game-store";
import type { ClientToServerEvents, JoinAck, ServerToClientEvents, SocketData } from "@/types/socket-events";

const JOIN_CODE = "ABC234";
const TIMINGS = { categoryMs: 20, readMs: 20, answerMs: 400 };

function seedGame(overrides: Partial<StoredGame> = {}): StoredGame {
  return {
    gameId: "game1",
    hostId: "host-user",
    language: "it",
    status: "lobby",
    numQuestions: 2,
    currentQuestionIndex: 0,
    questions: [1, 2].map(i => ({
      gameQuestionId: `gq${i}`,
      questionId: `q${i}`,
      position: i,
      category: "Storia",
      text: `Domanda ${i}`,
      choices: ["A", "B", "C", "D"],
      correctIndex: 1,
    })),
    teams: [],
    answers: [],
    ...overrides,
  };
}

class MemoryStore implements GameStore {
  games = new Map<string, StoredGame>();
  savedAnswers: StoredAnswer[] = [];
  deleted: string[] = [];
  failNextLoad = false;
  private nextId = 0;

  constructor(game: StoredGame) {
    this.games.set(JOIN_CODE, game);
  }
  private byId(gameId: string) {
    return [...this.games.values()].find(g => g.gameId === gameId)!;
  }
  async loadByJoinCode(joinCode: string) {
    if (this.failNextLoad) {
      this.failNextLoad = false;
      throw new Error("firestore unavailable");
    }
    const game = this.games.get(joinCode);
    return game ? structuredClone(game) : null;
  }
  newTeamId() {
    return `team${++this.nextId}`;
  }
  async createTeam(gameId: string, team: { id: string; name: string; photoUrl: string | null; rejoinToken: string }) {
    this.byId(gameId).teams.push({ id: team.id, name: team.name, photoUrl: team.photoUrl, rejoinToken: team.rejoinToken });
  }
  async updateTeamSocket() {}
  async saveAnswer(gameId: string, answer: StoredAnswer) {
    this.savedAnswers.push(answer);
    this.byId(gameId).answers.push(answer);
  }
  async saveProgress(gameId: string, progress: { currentQuestionIndex: number }) {
    const game = this.byId(gameId);
    game.status = "playing";
    game.currentQuestionIndex = progress.currentQuestionIndex;
  }
  async markFinished(gameId: string) {
    this.byId(gameId).status = "finished";
  }
  async deleteGame(gameId: string, joinCode: string) {
    this.games.delete(joinCode);
    this.deleted.push(gameId);
  }
}

let httpServer: HttpServer;
let ioServer: GameIO;
let manager: GameManager;
let store: MemoryStore;
let url: string;
const clients: ClientSocket[] = [];

async function startServer(game: StoredGame = seedGame()) {
  store = new MemoryStore(game);
  httpServer = createServer();
  ioServer = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(httpServer, {
    path: "/api/socketio",
    transports: ["websocket"],
  });
  manager = createGameManager(ioServer, {
    store,
    authenticate: async handshake => (typeof handshake.auth.testUser === "string" ? handshake.auth.testUser : null),
    timings: TIMINGS,
    sweepIntervalMs: 0,
  });
  await new Promise<void>(resolve => httpServer.listen(0, resolve));
  url = `http://localhost:${(httpServer.address() as AddressInfo).port}`;
}

async function stopServer() {
  for (const c of clients.splice(0)) c.disconnect();
  manager.shutdown();
  await new Promise<void>(resolve => ioServer.close(() => resolve()));
}

async function client(testUser?: string): Promise<ClientSocket> {
  const socket = connect(url, {
    path: "/api/socketio",
    transports: ["websocket"],
    forceNew: true,
    reconnection: false,
    auth: testUser ? { testUser } : {},
  });
  clients.push(socket);
  await new Promise<void>((resolve, reject) => {
    socket.once("connect", () => resolve());
    socket.once("connect_error", reject);
  });
  return socket;
}

function next<T = unknown>(socket: ClientSocket, event: string, timeoutMs = 1500): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), timeoutMs);
    socket.once(event, (data: T) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

function nothing(socket: ClientSocket, event: string, windowMs = 200): Promise<boolean> {
  return new Promise(resolve => {
    const handler = () => resolve(false);
    socket.once(event, handler);
    setTimeout(() => {
      socket.off(event, handler);
      resolve(true);
    }, windowMs);
  });
}

function join(socket: ClientSocket, teamName: string, rejoinToken?: string): Promise<JoinAck> {
  return socket.timeout(1500).emitWithAck("game:join", { joinCode: JOIN_CODE, teamName, rejoinToken });
}

async function host(): Promise<ClientSocket> {
  const socket = await client("host-user");
  const state = next(socket, "game:state");
  socket.emit("game:host-join", { joinCode: JOIN_CODE });
  await state;
  return socket;
}

async function requestState(socket: ClientSocket) {
  const state = next<{ phase: string; teams: Array<{ id: string; connected: boolean }>; question?: unknown; rankings?: unknown[] }>(socket, "game:state");
  socket.emit("game:request-state", { joinCode: JOIN_CODE });
  return state;
}

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

describe("game manager (socket integration)", () => {
  beforeEach(async () => {
    await startServer();
  });
  afterEach(async () => {
    await stopServer();
  });

  it("acknowledges a join whose team name has trailing spaces, with teamId and rejoin token", async () => {
    const player = await client();

    const ack = await join(player, "I Pirati  ");

    expect(ack).toMatchObject({ ok: true, teamName: "I Pirati" });
    if (ack.ok) {
      expect(ack.teamId).toBeTruthy();
      expect(ack.rejoinToken.length).toBeGreaterThan(10);
    }
  });

  it("lets players join before the host has opened the game (lazy load from storage)", async () => {
    const player = await client();
    expect((await join(player, "A")).ok).toBe(true);
  });

  it("rejects a duplicate name of a connected team, case-insensitively", async () => {
    await join(await client(), "I Pirati");
    const ack = await join(await client(), "i pirati");
    expect(ack).toEqual({ ok: false, code: "name-taken", error: "Nome squadra già in uso" });
  });

  it("returns the same team to a player that comes back with its rejoin token", async () => {
    const first = await client();
    const ack = await join(first, "A");
    if (!ack.ok) throw new Error("join failed");
    first.disconnect();

    const again = await join(await client(), "A", ack.rejoinToken);

    expect(again).toMatchObject({ ok: true, teamId: ack.teamId });
  });

  it("lets the rejoin token take over a connection the server still believes alive", async () => {
    const first = await client();
    const ack = await join(first, "A");
    if (!ack.ok) throw new Error("join failed");

    const again = await join(await client(), "A", ack.rejoinToken);

    expect(again).toMatchObject({ ok: true, teamId: ack.teamId });
  });

  it("ignores the late disconnect of a socket that was replaced by a rejoin", async () => {
    const hostSocket = await host();
    const first = await client();
    const ack = await join(first, "A");
    if (!ack.ok) throw new Error("join failed");
    await join(await client(), "A", ack.rejoinToken);

    first.disconnect();
    await wait(50);

    const state = await requestState(hostSocket);
    expect(state.teams.find(t => t.id === ack.teamId)?.connected).toBe(true);
  });

  it("counts the answer of a player that rejoined after losing its connection", async () => {
    const hostSocket = await host();
    const first = await client();
    const ack = await join(first, "A");
    if (!ack.ok) throw new Error("join failed");
    first.disconnect();
    const player = await client();
    await join(player, "A", ack.rejoinToken);

    hostSocket.emit("game:start", { joinCode: JOIN_CODE });
    const show = await next<{ question: { gameQuestionId: string } }>(player, "question:show");
    await next(player, "question:answer-phase");
    const results = next<{ rankings: Array<{ teamId: string; questionScore: number }> }>(hostSocket, "question:results");
    const answerAck = await player.timeout(1500).emitWithAck("answer:submit", {
      joinCode: JOIN_CODE,
      gameQuestionId: show.question.gameQuestionId,
      chosenIndex: 1,
    });

    expect(answerAck).toEqual({ ok: true });
    expect((await results).rankings[0]).toMatchObject({ teamId: ack.teamId });
    expect((await results).rankings[0].questionScore).toBeGreaterThan(0);
  });

  it("emits results exactly once when every team answers before the timer", async () => {
    const hostSocket = await host();
    const player = await client();
    await join(player, "A");
    let resultsCount = 0;
    hostSocket.on("question:results", () => resultsCount++);

    hostSocket.emit("game:start", { joinCode: JOIN_CODE });
    const show = await next<{ question: { gameQuestionId: string } }>(player, "question:show");
    await next(player, "question:answer-phase");
    player.emit("answer:submit", { joinCode: JOIN_CODE, gameQuestionId: show.question.gameQuestionId, chosenIndex: 1 });
    await wait(TIMINGS.answerMs + 150);

    expect(resultsCount).toBe(1);
  });

  it("does not let a player start the game", async () => {
    await host();
    const player = await client();
    await join(player, "A");

    player.emit("game:start", { joinCode: JOIN_CODE });

    expect(await nothing(player, "question:category")).toBe(true);
  });

  it("refuses the host role to a user who is not the game's host", async () => {
    const intruder = await client("someone-else");
    const error = next<{ message: string }>(intruder, "error");

    intruder.emit("game:host-join", { joinCode: JOIN_CODE });

    expect((await error).message).toMatch(/host/i);
  });

  it("ignores a cancel request from a player", async () => {
    await host();
    const player = await client();
    await join(player, "A");

    player.emit("game:cancel", { joinCode: JOIN_CODE });
    await wait(100);

    expect(store.deleted).toEqual([]);
  });

  it("reports a storage failure to the client and keeps serving", async () => {
    const player = await client();
    store.failNextLoad = true;

    const failed = await join(player, "A");
    const retried = await join(player, "A");

    expect(failed.ok).toBe(false);
    expect(retried.ok).toBe(true);
  });

  it("rejects invalid payloads without crashing", async () => {
    const player = await client();
    const ack = await player.timeout(1500).emitWithAck("game:join", { joinCode: 42, teamName: null });
    expect(ack.ok).toBe(false);
  });

  it("removes abandoned games during the sweep", async () => {
    const player = await client();
    await join(player, "A");
    player.disconnect();
    await wait(50);
    expect(manager.activeGameCount()).toBe(1);

    manager.sweep(Date.now() + 3 * 60 * 60 * 1000);

    expect(manager.activeGameCount()).toBe(0);
  });
});

describe("game manager recovery after a restart", () => {
  afterEach(async () => {
    await stopServer();
  });

  it("resumes a game in progress on the results screen with question and scores", async () => {
    await startServer(
      seedGame({
        status: "playing",
        currentQuestionIndex: 1,
        teams: [{ id: "t1", name: "A", photoUrl: null, rejoinToken: "tok-1" }],
        answers: [{ teamId: "t1", gameQuestionId: "gq1", chosenIndex: 1, score: 180 }],
      }),
    );
    const hostSocket = await client("host-user");
    const state = next<{ phase: string; question?: { gameQuestionId: string }; rankings?: Array<{ totalScore: number }> }>(hostSocket, "game:state");

    hostSocket.emit("game:host-join", { joinCode: JOIN_CODE });

    const s = await state;
    expect(s.phase).toBe("results");
    expect(s.question?.gameQuestionId).toBe("gq1");
    expect(s.rankings?.[0].totalScore).toBe(180);
  });

  it("lets a team rejoin with its persisted token after a restart", async () => {
    await startServer(seedGame({ teams: [{ id: "t1", name: "A", photoUrl: null, rejoinToken: "tok-1" }] }));

    const ack = await join(await client(), "whatever", "tok-1");

    expect(ack).toMatchObject({ ok: true, teamId: "t1", teamName: "A" });
  });
});
