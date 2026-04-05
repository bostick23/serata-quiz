"use client";

import { useEffect, useState, useCallback } from "react";
import type { Socket } from "socket.io-client";
import type { GameState } from "@/types/game";
import { toLocalDeadline } from "./use-socket";

const initialState: GameState = {
  joinCode: "",
  phase: "lobby",
  language: "it",
  currentQuestion: 0,
  numQuestions: 0,
  teams: [],
};

export function useGameState(socket: Socket | null, joinCode: string) {
  const [gameState, setGameState] = useState<GameState>(initialState);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [answeredTeams, setAnsweredTeams] = useState<Set<string>>(new Set());
  const [rankingsRevealed, setRankingsRevealed] = useState(false);

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

    socket.on("question:category", ({ category, questionNumber, totalQuestions, deadline: d }) => {
      setGameState(prev => ({ ...prev, phase: "category", currentQuestion: questionNumber, correctIndex: undefined, rankings: undefined, isLastQuestion: undefined, categoryName: category }));
      setDeadline(toLocalDeadline(d));
      setAnsweredTeams(new Set());
    });

    socket.on("question:show", ({ question, phase, deadline: d }) => {
      setGameState(prev => ({ ...prev, phase: "read", question, correctIndex: undefined, rankings: undefined, isLastQuestion: undefined }));
      setDeadline(toLocalDeadline(d));
      setAnsweredTeams(new Set());
    });

    socket.on("question:answer-phase", ({ deadline: d }) => {
      setGameState(prev => ({ ...prev, phase: "answer" }));
      setDeadline(toLocalDeadline(d));
    });

    socket.on("answer:received", ({ teamId }) => {
      setAnsweredTeams(prev => new Set(prev).add(teamId));
    });

    socket.on("question:results", ({ rankings, correctIndex, isLastQuestion }) => {
      setGameState(prev => ({ ...prev, phase: "results", rankings, correctIndex, isLastQuestion }));
      setDeadline(null);
    });

    socket.on("game:finished", ({ rankings }) => {
      setGameState(prev => ({ ...prev, phase: "finished", rankings }));
      setDeadline(null);
      setRankingsRevealed(false);
    });

    socket.on("rankings:revealed", () => {
      setRankingsRevealed(true);
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
      socket.off("question:category");
      socket.off("question:show");
      socket.off("question:answer-phase");
      socket.off("answer:received");
      socket.off("question:results");
      socket.off("game:finished");
      socket.off("rankings:revealed");
      socket.off("game:cancelled");
      socket.off("error");
    };
  }, [socket]);

  return { gameState, deadline, error, answeredTeams, rankingsRevealed, setError };
}
