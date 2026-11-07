import { describe, it, expect } from "vitest";
import {
  createRuntime,
  addTeam,
  findTeamByName,
  normalizeTeamName,
  startQuestion,
  beginRead,
  beginAnswer,
  recordAnswer,
  allTeamsAnswered,
  endAnswerPhase,
  computeFinalRankings,
  restoreScores,
  toPublicState,
  type EngineQuestion,
} from "./game-engine";

function questions(n: number): EngineQuestion[] {
  return Array.from({ length: n }, (_, i) => ({
    gameQuestionId: `gq${i + 1}`,
    questionId: `q${i + 1}`,
    position: i + 1,
    category: i % 2 === 0 ? "Storia" : "Sport",
    text: `Domanda ${i + 1}`,
    choices: ["A", "B", "C", "D"],
    correctIndex: 1,
  }));
}

function runtimeWithTeams(teamNames: string[], numQuestions = 3) {
  const game = createRuntime({ numQuestions, questions: questions(numQuestions) });
  for (const [i, name] of teamNames.entries()) {
    addTeam(game, { id: `t${i + 1}`, name, photoUrl: null, rejoinToken: `tok${i + 1}`, socketId: `s${i + 1}`, connected: true });
  }
  return game;
}

/** Drives the runtime to the answer phase of question `index` at time `now`. */
function toAnswerPhase(game: ReturnType<typeof runtimeWithTeams>, index: number, now: number) {
  startQuestion(game, index);
  beginRead(game, now);
  beginAnswer(game, now);
}

describe("normalizeTeamName", () => {
  it("trims and collapses internal whitespace", () => {
    expect(normalizeTeamName("  I   Pirati \n")).toBe("I Pirati");
  });
});

describe("findTeamByName", () => {
  it("matches names case-insensitively and ignoring extra whitespace", () => {
    const game = runtimeWithTeams(["I Pirati"]);
    expect(findTeamByName(game, " i pirati ")?.id).toBe("t1");
  });
});

describe("recordAnswer", () => {
  it("adds the score to the team total immediately", () => {
    const game = runtimeWithTeams(["A"]);
    toAnswerPhase(game, 1, 1_000);

    const result = recordAnswer(game, "t1", "gq1", 1, 1_000);

    expect(result.ok).toBe(true);
    expect(game.scores.get("t1")).toBe(200);
  });

  it("rejects a second answer from the same team", () => {
    const game = runtimeWithTeams(["A"]);
    toAnswerPhase(game, 1, 1_000);
    recordAnswer(game, "t1", "gq1", 1, 1_000);

    const second = recordAnswer(game, "t1", "gq1", 0, 1_500);

    expect(second).toEqual({ ok: false, reason: "already-answered" });
    expect(game.scores.get("t1")).toBe(200);
  });

  it("rejects answers outside the answer phase", () => {
    const game = runtimeWithTeams(["A"]);
    startQuestion(game, 1);
    beginRead(game, 1_000);

    expect(recordAnswer(game, "t1", "gq1", 1, 1_000)).toEqual({ ok: false, reason: "wrong-phase" });
  });

  it("rejects answers for a question that is not the current one", () => {
    const game = runtimeWithTeams(["A"]);
    toAnswerPhase(game, 2, 1_000);

    expect(recordAnswer(game, "t1", "gq1", 1, 1_000)).toEqual({ ok: false, reason: "stale-question" });
  });

  it("rejects a choice index outside the available choices", () => {
    const game = runtimeWithTeams(["A"]);
    toAnswerPhase(game, 1, 1_000);

    expect(recordAnswer(game, "t1", "gq1", 7, 1_000)).toEqual({ ok: false, reason: "invalid-choice" });
  });

  it("rejects answers from unknown teams", () => {
    const game = runtimeWithTeams(["A"]);
    toAnswerPhase(game, 1, 1_000);

    expect(recordAnswer(game, "ghost", "gq1", 1, 1_000)).toEqual({ ok: false, reason: "unknown-team" });
  });

  it("gives a negative score to a wrong answer", () => {
    const game = runtimeWithTeams(["A"]);
    toAnswerPhase(game, 1, 1_000);

    recordAnswer(game, "t1", "gq1", 0, 1_000);

    expect(game.scores.get("t1")).toBe(-200);
  });
});

describe("allTeamsAnswered", () => {
  it("is true only once every team has answered", () => {
    const game = runtimeWithTeams(["A", "B"]);
    toAnswerPhase(game, 1, 1_000);
    recordAnswer(game, "t1", "gq1", 1, 1_000);
    expect(allTeamsAnswered(game)).toBe(false);

    recordAnswer(game, "t2", "gq1", 1, 1_000);
    expect(allTeamsAnswered(game)).toBe(true);
  });
});

describe("endAnswerPhase", () => {
  it("produces results only once even if called twice (timer + all answered race)", () => {
    const game = runtimeWithTeams(["A"]);
    toAnswerPhase(game, 1, 1_000);
    recordAnswer(game, "t1", "gq1", 1, 1_000);

    const first = endAnswerPhase(game, "gq1");
    const second = endAnswerPhase(game, "gq1");

    expect(first).not.toBeNull();
    expect(second).toBeNull();
    expect(game.phase).toBe("results");
  });

  it("ignores a stale timer for a previous question", () => {
    const game = runtimeWithTeams(["A"]);
    toAnswerPhase(game, 2, 1_000);

    expect(endAnswerPhase(game, "gq1")).toBeNull();
    expect(game.phase).toBe("answer");
  });

  it("question score and total score are consistent with recorded answers", () => {
    const game = runtimeWithTeams(["A", "B", "C"]);
    toAnswerPhase(game, 1, 0);
    recordAnswer(game, "t1", "gq1", 1, 0); // +200
    recordAnswer(game, "t2", "gq1", 0, 10_000); // -50
    endAnswerPhase(game, "gq1");

    toAnswerPhase(game, 2, 0);
    recordAnswer(game, "t2", "gq2", 1, 0); // +200
    const results = endAnswerPhase(game, "gq2")!;

    const byTeam = Object.fromEntries(results.rankings.map(r => [r.teamId, r]));
    expect(byTeam.t1).toMatchObject({ questionScore: 0, totalScore: 200, isCorrect: null, chosenIndex: null });
    expect(byTeam.t2).toMatchObject({ questionScore: 200, totalScore: 150, isCorrect: true, chosenIndex: 1 });
    expect(byTeam.t3).toMatchObject({ questionScore: 0, totalScore: 0 });
    expect(results.rankings.map(r => r.teamId)).toEqual(["t1", "t2", "t3"]);
  });

  it("reports the last question and the next category", () => {
    const game = runtimeWithTeams(["A"], 2);
    toAnswerPhase(game, 1, 0);
    const first = endAnswerPhase(game, "gq1")!;
    expect(first.isLastQuestion).toBe(false);
    expect(first.nextCategory).toBe("Sport");

    toAnswerPhase(game, 2, 0);
    const last = endAnswerPhase(game, "gq2")!;
    expect(last.isLastQuestion).toBe(true);
    expect(last.nextCategory).toBeNull();
  });

  it("does not include team photos in rankings", () => {
    const game = runtimeWithTeams(["A"]);
    game.teams.get("t1")!.photoUrl = "data:image/jpeg;base64,AAAA";
    toAnswerPhase(game, 1, 0);

    const results = endAnswerPhase(game, "gq1")!;

    expect(results.rankings[0]).not.toHaveProperty("photoUrl");
  });
});

describe("startQuestion", () => {
  it("returns null and leaves the state untouched when the position does not exist", () => {
    const game = runtimeWithTeams(["A"], 2);

    expect(startQuestion(game, 5)).toBeNull();
    expect(game.phase).toBe("lobby");
    expect(game.currentQuestionIndex).toBe(0);
  });

  it("clears the answers of the previous question", () => {
    const game = runtimeWithTeams(["A"]);
    toAnswerPhase(game, 1, 0);
    recordAnswer(game, "t1", "gq1", 1, 0);
    endAnswerPhase(game, "gq1");

    startQuestion(game, 2);

    expect(game.currentAnswers.size).toBe(0);
    expect(game.phase).toBe("category");
  });
});

describe("restoreScores", () => {
  it("rebuilds totals and the current question answers after a restart", () => {
    const game = runtimeWithTeams(["A", "B"]);
    game.currentQuestionIndex = 2;
    game.phase = "results";

    restoreScores(game, [
      { teamId: "t1", gameQuestionId: "gq1", chosenIndex: 1, score: 200 },
      { teamId: "t1", gameQuestionId: "gq2", chosenIndex: 1, score: 150 },
      { teamId: "t2", gameQuestionId: "gq2", chosenIndex: 0, score: -100 },
    ]);

    expect(game.scores.get("t1")).toBe(350);
    expect(game.scores.get("t2")).toBe(-100);
    expect(game.currentAnswers.get("t2")).toMatchObject({ chosenIndex: 0, score: -100 });
    expect(game.currentAnswers.has("t1")).toBe(true);
  });
});

describe("computeFinalRankings", () => {
  it("sorts by total score descending", () => {
    const game = runtimeWithTeams(["A", "B"]);
    game.scores.set("t1", 100);
    game.scores.set("t2", 300);

    expect(computeFinalRankings(game).map(r => r.teamId)).toEqual(["t2", "t1"]);
  });
});

describe("toPublicState", () => {
  it("never exposes socket ids, rejoin tokens or the correct answer before results", () => {
    const game = runtimeWithTeams(["A"]);
    toAnswerPhase(game, 1, 0);

    const state = toPublicState(game, "ABC123", "it");
    const serialized = JSON.stringify(state);

    expect(serialized).not.toContain("tok1");
    expect(serialized).not.toContain("s1");
    expect(serialized).not.toContain("correctIndex");
    expect(state.question?.text).toBe("Domanda 1");
  });

  it("includes rankings, correct answer and the question during results", () => {
    const game = runtimeWithTeams(["A"]);
    toAnswerPhase(game, 1, 0);
    recordAnswer(game, "t1", "gq1", 1, 0);
    endAnswerPhase(game, "gq1");

    const state = toPublicState(game, "ABC123", "it");

    expect(state.phase).toBe("results");
    expect(state.correctIndex).toBe(1);
    expect(state.rankings?.[0].teamId).toBe("t1");
    expect(state.question?.gameQuestionId).toBe("gq1");
  });
});
