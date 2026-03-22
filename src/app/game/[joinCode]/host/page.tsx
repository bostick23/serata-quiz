"use client";

import { use, useEffect, useState } from "react";
import { useSocket } from "@/hooks/use-socket";
import { useGameState } from "@/hooks/use-game-state";
import { useCountdown } from "@/hooks/use-countdown";
import { motion, AnimatePresence } from "framer-motion";
import type { RankingEntry } from "@/types/game";

interface Props {
  params: Promise<{ joinCode: string }>;
}

export default function HostPage({ params }: Props) {
  const { joinCode } = use(params);
  const { socket, isConnected } = useSocket();
  const { gameState, deadline, error, answeredTeams, revealedEntries } = useGameState(socket, joinCode);
  const { seconds } = useCountdown(deadline ?? null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [joinUrl, setJoinUrl] = useState("");

  useEffect(() => {
    setJoinUrl(`${window.location.origin}/game/${joinCode}/play`);
  }, [joinCode]);

  useEffect(() => {
    if (socket && isConnected) {
      socket.emit("game:host-join", { joinCode });
    }
  }, [socket, isConnected, joinCode]);

  useEffect(() => {
    if (gameState.phase === "lobby") {
      fetch(`/api/games/qr?joinCode=${joinCode}`)
        .then((res) => res.json())
        .then((data) => setQrDataUrl(data.qrDataUrl))
        .catch(() => {});
    }
  }, [gameState.phase, joinCode]);

  function handleStart() {
    socket?.emit("game:start", { joinCode });
  }

  function handleNextQuestion() {
    socket?.emit("question:next", { joinCode });
  }

  function handleRevealNext() {
    socket?.emit("reveal:next", { joinCode });
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Connection indicator */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full ${isConnected ? "bg-emerald-500" : "bg-red-500"} animate-pulse`} />
        <span className="text-xs text-slate-400">{isConnected ? "Connesso" : "Disconnesso"}</span>
      </div>

      {error && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-500/20 border border-red-500/50 text-red-400 px-6 py-3 rounded-xl">
          {error}
        </div>
      )}

      <AnimatePresence mode="wait">
        {/* LOBBY PHASE */}
        {gameState.phase === "lobby" && (
          <motion.div
            key="lobby"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center p-8"
          >
            <h1 className="text-5xl font-extrabold gradient-text mb-8">Serata Quiz</h1>

            <div className="flex flex-col lg:flex-row gap-8 items-center max-w-4xl w-full">
              {/* QR Code + Join Info */}
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 text-center shadow-xl">
                {qrDataUrl && (
                  <img src={qrDataUrl} alt="QR Code" className="w-64 h-64 mx-auto mb-4 rounded-xl" />
                )}
                <p className="text-slate-400 text-sm mb-2">Codice partita:</p>
                <p className="text-4xl font-mono font-bold text-purple-400 mb-3">{joinCode}</p>
                <p className="text-slate-500 text-xs break-all">{joinUrl}</p>
              </div>

              {/* Teams list */}
              <div className="flex-1 w-full">
                <h2 className="text-xl font-semibold mb-4">
                  Squadre ({gameState.teams.length})
                </h2>

                {gameState.teams.length === 0 ? (
                  <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 text-center">
                    <p className="text-slate-400">In attesa che le squadre si uniscano...</p>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {gameState.teams.map((team) => (
                      <motion.div
                        key={team.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex items-center gap-4"
                      >
                        {team.photoUrl ? (
                          <img
                            src={team.photoUrl}
                            alt={team.name}
                            className="w-12 h-12 rounded-full object-cover border-2 border-purple-500"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center text-white font-bold text-lg">
                            {team.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="font-semibold text-lg">{team.name}</span>
                        <div className={`ml-auto w-3 h-3 rounded-full ${team.connected ? "bg-emerald-500" : "bg-slate-500"}`} />
                      </motion.div>
                    ))}
                  </div>
                )}

                {gameState.teams.length >= 1 && (
                  <button
                    onClick={handleStart}
                    className="mt-6 w-full py-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 text-white font-bold text-xl shadow-lg hover:shadow-pink-500/25 hover:scale-[1.02] transition-all"
                  >
                    Inizia Partita
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* READ PHASE */}
        {gameState.phase === "read" && gameState.question && (
          <motion.div
            key="read"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center p-8"
          >
            <div className="text-amber-400 text-xl font-bold mb-4 tracking-widest uppercase">
              Leggi la domanda
            </div>

            <div className="text-slate-400 mb-2 text-sm">
              Manche {gameState.question.roundNumber} - Domanda {gameState.question.position}/{gameState.question.totalQuestions}
            </div>

            {/* Countdown */}
            <div className="mb-8">
              <div className={`text-7xl font-bold font-mono ${seconds <= 3 ? "text-red-500 animate-pulse" : "text-white"}`}>
                {seconds}
              </div>
            </div>

            <div className="max-w-3xl w-full bg-slate-800 border border-slate-700 rounded-2xl p-8 shadow-xl mb-8">
              <h2 className="text-3xl font-bold text-center mb-8">{gameState.question.text}</h2>

              <div className="grid grid-cols-2 gap-4">
                {gameState.question.choices.map((choice, i) => {
                  const colors = ["bg-red-500", "bg-blue-500", "bg-emerald-500", "bg-amber-500"];
                  return (
                    <div
                      key={i}
                      className={`${colors[i]} rounded-xl p-5 text-white text-xl font-semibold text-center`}
                    >
                      {choice}
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

        {/* ANSWER PHASE */}
        {gameState.phase === "answer" && gameState.question && (
          <motion.div
            key="answer"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center p-8"
          >
            <div className="text-emerald-400 text-xl font-bold mb-4 tracking-widest uppercase animate-pulse">
              Rispondete!
            </div>

            <div className="mb-8">
              <div className={`text-7xl font-bold font-mono ${seconds <= 3 ? "text-red-500 animate-pulse" : "text-white"}`}>
                {seconds}
              </div>
            </div>

            <div className="max-w-3xl w-full bg-slate-800 border border-slate-700 rounded-2xl p-8 shadow-xl mb-8">
              <h2 className="text-3xl font-bold text-center mb-8">{gameState.question.text}</h2>

              <div className="grid grid-cols-2 gap-4">
                {gameState.question.choices.map((choice, i) => {
                  const colors = ["bg-red-500", "bg-blue-500", "bg-emerald-500", "bg-amber-500"];
                  return (
                    <div
                      key={i}
                      className={`${colors[i]} rounded-xl p-5 text-white text-xl font-semibold text-center`}
                    >
                      {choice}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="text-slate-400 text-lg">
              {answeredTeams.size}/{gameState.teams.length} squadre hanno risposto
            </div>
          </motion.div>
        )}

        {/* RESULTS PHASE */}
        {gameState.phase === "results" && gameState.question && (
          <motion.div
            key="results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center p-8"
          >
            <div className="text-purple-400 text-xl font-bold mb-6 tracking-widest uppercase">
              Risultati
            </div>

            <div className="max-w-3xl w-full bg-slate-800 border border-slate-700 rounded-2xl p-8 shadow-xl mb-8">
              <h2 className="text-2xl font-bold text-center mb-6">{gameState.question.text}</h2>

              <div className="grid grid-cols-2 gap-4">
                {gameState.question.choices.map((choice, i) => {
                  const isCorrect = i === gameState.correctIndex;
                  return (
                    <motion.div
                      key={i}
                      initial={{ scale: 1 }}
                      animate={isCorrect ? { scale: [1, 1.05, 1] } : {}}
                      transition={{ duration: 0.5 }}
                      className={`rounded-xl p-5 text-white text-xl font-semibold text-center border-2 ${
                        isCorrect
                          ? "bg-emerald-500 border-emerald-300 shadow-lg shadow-emerald-500/30"
                          : "bg-red-500/30 border-red-500/30 opacity-60"
                      }`}
                    >
                      {choice}
                      {isCorrect && <span className="ml-2">&#x2713;</span>}
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Rankings table */}
            {gameState.rankings && (
              <div className="max-w-xl w-full bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl mb-6">
                <h3 className="text-lg font-semibold mb-4 text-center">Classifica</h3>
                <div className="space-y-2">
                  {gameState.rankings.map((entry, i) => (
                    <motion.div
                      key={entry.teamId}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className={`flex items-center gap-3 p-3 rounded-xl ${
                        entry.isCorrect ? "bg-emerald-500/10 border border-emerald-500/30" : "bg-slate-700/50"
                      }`}
                    >
                      <span className="text-2xl font-bold text-slate-400 w-8">{i + 1}</span>
                      <span className="flex-1 font-medium">{entry.teamName}</span>
                      <span className={`text-sm font-mono ${entry.isCorrect ? "text-emerald-400" : "text-red-400"}`}>
                        +{entry.questionScore}
                      </span>
                      <span className="text-lg font-bold text-purple-400">{entry.totalScore}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={handleNextQuestion}
              className="px-8 py-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 text-white font-bold text-lg shadow-lg hover:shadow-pink-500/25 hover:scale-[1.02] transition-all"
            >
              Prossima domanda
            </button>
          </motion.div>
        )}

        {/* ROUND-END PHASE - Dramatic reveal */}
        {gameState.phase === "round-end" && (
          <motion.div
            key="round-end"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center p-8 cursor-pointer select-none"
            onClick={handleRevealNext}
          >
            <motion.h1
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-4xl sm:text-5xl font-extrabold gradient-text mb-12 text-center"
            >
              Classifica Manche {gameState.currentRound}
            </motion.h1>

            <div className="max-w-xl w-full space-y-4">
              <AnimatePresence>
                {revealedEntries.map((entry, i) => {
                  const position = revealedEntries.length - i;
                  const isFirst = position === 1;
                  const isSecond = position === 2;
                  const isThird = position === 3;
                  return (
                    <motion.div
                      key={entry.teamId}
                      initial={{ opacity: 0, x: -100, scale: 0.8 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      transition={{ type: "spring", stiffness: 200, damping: 20 }}
                      className={`flex items-center gap-4 p-5 rounded-2xl border shadow-lg ${
                        isFirst
                          ? "bg-amber-400/20 border-amber-400/50 shadow-amber-400/20"
                          : isSecond
                          ? "bg-slate-300/10 border-slate-400/30"
                          : isThird
                          ? "bg-orange-600/10 border-orange-500/30"
                          : "bg-slate-800 border-slate-700"
                      }`}
                    >
                      <span className={`text-4xl font-extrabold ${
                        isFirst ? "text-amber-400" : isSecond ? "text-slate-300" : isThird ? "text-orange-500" : "text-slate-500"
                      }`}>
                        {position}
                      </span>
                      {entry.photoUrl ? (
                        <img src={entry.photoUrl} alt={entry.teamName} className="w-14 h-14 rounded-full object-cover border-2 border-purple-500" />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center text-white font-bold text-xl">
                          {entry.teamName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="flex-1 text-xl font-bold">{entry.teamName}</span>
                      <span className="text-2xl font-bold text-purple-400">{entry.totalScore}</span>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            {revealedEntries.length === 0 && (
              <p className="text-slate-400 text-lg animate-pulse mt-8">Clicca per rivelare la classifica...</p>
            )}

            {revealedEntries.length > 0 && gameState.rankings && revealedEntries.length < gameState.rankings.length && (
              <p className="text-slate-500 text-sm mt-8 animate-pulse">Clicca per la prossima posizione...</p>
            )}
          </motion.div>
        )}

        {/* FINISHED PHASE */}
        {gameState.phase === "finished" && (
          <motion.div
            key="finished"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 flex flex-col items-center justify-center p-8"
          >
            <motion.h1
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 150 }}
              className="text-5xl sm:text-6xl font-extrabold gradient-text mb-4 text-center"
            >
              Partita Terminata!
            </motion.h1>

            <p className="text-slate-400 text-lg mb-12">Classifica finale</p>

            <div className="max-w-xl w-full space-y-4">
              {gameState.rankings?.map((entry, i) => {
                const isFirst = i === 0;
                const isSecond = i === 1;
                const isThird = i === 2;
                return (
                  <motion.div
                    key={entry.teamId}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.15 }}
                    className={`flex items-center gap-4 p-5 rounded-2xl border shadow-lg ${
                      isFirst
                        ? "bg-amber-400/20 border-amber-400/50 shadow-amber-400/20"
                        : isSecond
                        ? "bg-slate-300/10 border-slate-400/30"
                        : isThird
                        ? "bg-orange-600/10 border-orange-500/30"
                        : "bg-slate-800 border-slate-700"
                    }`}
                  >
                    <span className={`text-4xl font-extrabold ${
                      isFirst ? "text-amber-400" : isSecond ? "text-slate-300" : isThird ? "text-orange-500" : "text-slate-500"
                    }`}>
                      {i + 1}
                    </span>
                    {entry.photoUrl ? (
                      <img src={entry.photoUrl} alt={entry.teamName} className="w-14 h-14 rounded-full object-cover border-2 border-purple-500" />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center text-white font-bold text-xl">
                        {entry.teamName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="flex-1 text-xl font-bold">{entry.teamName}</span>
                    <span className="text-2xl font-bold text-purple-400">{entry.totalScore}</span>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
