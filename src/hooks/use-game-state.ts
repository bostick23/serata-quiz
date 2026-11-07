"use client";

import { useEffect, useState } from "react";
import type { GameState, TeamInfo } from "@/types/game";
import type { ServerToClientEvents } from "@/types/socket-events";
import { toLocalDeadline, type TypedSocket } from "./use-socket";
import { getCategoryImage } from "@/lib/category-images";

const initialState: GameState = {
  joinCode: "",
  phase: "lobby",
  language: "it",
  currentQuestion: 0,
  numQuestions: 0,
  teams: [],
};

/** Warms the browser cache so the next category animation is ready when its 5-second phase starts. */
function preloadCategoryImage(category: string | null | undefined) {
  if (!category || typeof window === "undefined") return;
  const img = new Image();
  img.src = getCategoryImage(category);
}

export function useGameState(socket: TypedSocket | null) {
  const [gameState, setGameState] = useState<GameState>(initialState);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [answeredTeams, setAnsweredTeams] = useState<Set<string>>(new Set());
  const [rankingsRevealed, setRankingsRevealed] = useState(false);

  useEffect(() => {
    if (!socket) return;

    const handlers: { [E in keyof ServerToClientEvents]?: ServerToClientEvents[E] } = {
      "game:state": state => {
        setGameState(state);
        setDeadline(state.deadline ? toLocalDeadline(state.deadline) : null);
        setAnsweredTeams(new Set(state.answeredTeamIds ?? []));
        setRankingsRevealed(state.rankingsRevealed ?? false);
        setError(null);
      },
      "team:joined": ({ team }) => {
        setGameState(prev => ({ ...prev, teams: upsertTeam(prev.teams, team) }));
      },
      "team:left": ({ teamId }) => {
        setGameState(prev => ({
          ...prev,
          teams: prev.teams.map(t => (t.id === teamId ? { ...t, connected: false } : t)),
        }));
      },
      "question:category": ({ category, questionNumber, deadline: d }) => {
        setGameState(prev => ({
          ...prev,
          phase: "category",
          currentQuestion: questionNumber,
          correctIndex: undefined,
          rankings: undefined,
          isLastQuestion: undefined,
          categoryName: category,
        }));
        setDeadline(toLocalDeadline(d));
        setAnsweredTeams(new Set());
      },
      "question:show": ({ question, deadline: d }) => {
        setGameState(prev => ({ ...prev, phase: "read", question, correctIndex: undefined, rankings: undefined, isLastQuestion: undefined }));
        setDeadline(toLocalDeadline(d));
        setAnsweredTeams(new Set());
      },
      "question:answer-phase": ({ deadline: d }) => {
        setGameState(prev => ({ ...prev, phase: "answer" }));
        setDeadline(toLocalDeadline(d));
      },
      "answer:received": ({ teamId }) => {
        setAnsweredTeams(prev => new Set(prev).add(teamId));
      },
      "question:results": ({ rankings, correctIndex, isLastQuestion, nextCategory }) => {
        setGameState(prev => ({ ...prev, phase: "results", rankings, correctIndex, isLastQuestion }));
        setDeadline(null);
        preloadCategoryImage(nextCategory);
      },
      "game:finished": ({ rankings }) => {
        setGameState(prev => ({ ...prev, phase: "finished", rankings }));
        setDeadline(null);
        setRankingsRevealed(false);
      },
      "rankings:revealed": () => {
        setRankingsRevealed(true);
      },
      "game:cancelled": ({ message }) => {
        setGameState(prev => ({ ...prev, phase: "cancelled" }));
        setDeadline(null);
        setError(message);
      },
      error: ({ message }) => {
        setError(message);
      },
    };

    const entries = Object.entries(handlers) as Array<[keyof ServerToClientEvents, (...args: never[]) => void]>;
    for (const [event, handler] of entries) socket.on(event, handler as never);
    // Remove only our own listeners: other components may listen to the same events.
    return () => {
      for (const [event, handler] of entries) socket.off(event, handler as never);
    };
  }, [socket]);

  return { gameState, deadline, error, answeredTeams, rankingsRevealed, setError };
}

function upsertTeam(teams: TeamInfo[], team: TeamInfo): TeamInfo[] {
  const index = teams.findIndex(t => t.id === team.id);
  if (index === -1) return [...teams, team];
  const copy = [...teams];
  copy[index] = team;
  return copy;
}
