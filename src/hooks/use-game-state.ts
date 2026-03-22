"use client";

import { useEffect, useState, useCallback } from "react";
import type { Socket } from "socket.io-client";
import type { GameState, RankingEntry } from "@/types/game";

const initialState: GameState = {
  joinCode: "",
  phase: "lobby",
  currentRound: 0,
  currentQuestion: 0,
  totalRounds: 0,
  questionsPerRound: 0,
  teams: [],
};

export function useGameState(socket: Socket | null, joinCode: string) {
  const [gameState, setGameState] = useState<GameState>(initialState);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [answeredTeams, setAnsweredTeams] = useState<Set<string>>(new Set());
  const [revealedEntries, setRevealedEntries] = useState<RankingEntry[]>([]);

  useEffect(() => {
    if (!socket) return;

    socket.on("game:state", (state: GameState) => {
      setGameState(state);
      setError(null);
    });

    socket.on("team:joined", ({ team, teamCount }) => {
      setGameState(prev => ({
        ...prev,
        teams: [...prev.teams.filter(t => t.id !== team.id), team],
      }));
    });

    socket.on("team:left", ({ teamId }) => {
      setGameState(prev => ({
        ...prev,
        teams: prev.teams.map(t => t.id === teamId ? { ...t, connected: false } : t),
      }));
    });

    socket.on("question:show", ({ question, phase, deadline: d }) => {
      setGameState(prev => ({ ...prev, phase: "read", question, correctIndex: undefined, rankings: undefined }));
      setDeadline(d);
      setAnsweredTeams(new Set());
      setRevealedEntries([]);
    });

    socket.on("question:answer-phase", ({ deadline: d }) => {
      setGameState(prev => ({ ...prev, phase: "answer" }));
      setDeadline(d);
    });

    socket.on("answer:received", ({ teamId }) => {
      setAnsweredTeams(prev => new Set(prev).add(teamId));
    });

    socket.on("question:results", ({ rankings, correctIndex }) => {
      setGameState(prev => ({ ...prev, phase: "results", rankings, correctIndex }));
      setDeadline(null);
    });

    socket.on("round:end", ({ round, rankings }) => {
      setGameState(prev => ({ ...prev, phase: "round-end", rankings, revealedPositions: 0 }));
      setDeadline(null);
      setRevealedEntries([]);
    });

    socket.on("reveal:position", ({ position, entry }) => {
      setRevealedEntries(prev => [entry, ...prev]);
      setGameState(prev => ({ ...prev, revealedPositions: position }));
    });

    socket.on("game:finished", ({ rankings }) => {
      setGameState(prev => ({ ...prev, phase: "finished", rankings }));
      setDeadline(null);
    });

    socket.on("game:cancelled", ({ message }) => {
      setGameState(prev => ({ ...prev, phase: "cancelled" }));
      setDeadline(null);
      setError(message);
    });

    socket.on("error", ({ message }) => {
      setError(message);
    });

    return () => {
      socket.off("game:state");
      socket.off("team:joined");
      socket.off("team:left");
      socket.off("question:show");
      socket.off("question:answer-phase");
      socket.off("answer:received");
      socket.off("question:results");
      socket.off("round:end");
      socket.off("reveal:position");
      socket.off("game:finished");
      socket.off("game:cancelled");
      socket.off("error");
    };
  }, [socket]);

  return { gameState, deadline, error, answeredTeams, revealedEntries, setError };
}
