"use client";

import { use, useEffect, useState, useRef } from "react";
import { useSocket } from "@/hooks/use-socket";
import { useGameState } from "@/hooks/use-game-state";
import { useCountdown } from "@/hooks/use-countdown";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  params: Promise<{ joinCode: string }>;
}

export default function PlayPage({ params }: Props) {
  const { joinCode } = use(params);
  const { socket, isConnected } = useSocket();
  const { gameState, deadline, error, revealedEntries } = useGameState(socket, joinCode);
  const { seconds } = useCountdown(deadline ?? null);

  const [teamName, setTeamName] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [myTeamId, setMyTeamId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Listen for team:joined to confirm our own join and get our teamId
  useEffect(() => {
    if (!socket) return;

    const handler = ({ team }: { team: { id: string; name: string } }) => {
      if (team.name === teamName) {
        console.log("[Play] Team joined confirmed:", team.name, team.id);
        setMyTeamId(team.id);
        setJoined(true);
        setJoining(false);
      }
    };

    const joinErrorHandler = () => {
      // Error message display is handled by useGameState's error listener;
      // here we only reset the pending join state so the user can retry.
      setJoining(false);
    };

    socket.on("team:joined", handler);
    socket.on("error", joinErrorHandler);
    return () => {
      socket.off("team:joined", handler);
      socket.off("error", joinErrorHandler);
    };
  }, [socket, teamName]);

  // Reset selected answer when a new question arrives
  useEffect(() => {
    if (gameState.phase === "read" || gameState.phase === "answer") {
      setSelectedAnswer(null);
    }
  }, [gameState.question?.gameQuestionId]);

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!socket || !isConnected || !teamName.trim()) return;
    console.log("[Play] Emitting game:join", { joinCode, teamName: teamName.trim(), connected: socket.connected });
    setJoining(true);
    socket.emit("game:join", { joinCode, teamName: teamName.trim(), photoUrl: photoUrl ?? undefined });
  }

  function handleAnswer(chosenIndex: number) {
    if (!socket || !gameState.question || selectedAnswer !== null) return;
    setSelectedAnswer(chosenIndex);
    socket.emit("answer:submit", {
      joinCode,
      gameQuestionId: gameState.question.gameQuestionId,
      chosenIndex,
    });
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Convert to data URL for simplicity
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  const myRanking = gameState.rankings?.find((r) => r.teamId === myTeamId);
  const myPosition = gameState.rankings?.findIndex((r) => r.teamId === myTeamId);

  const choiceColors = [
    "bg-red-500 active:bg-red-600",
    "bg-blue-500 active:bg-blue-600",
    "bg-emerald-500 active:bg-emerald-600",
    "bg-amber-500 active:bg-amber-600",
  ];

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Connection indicator */}
      <div className="fixed top-3 right-3 z-50">
        <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? "bg-emerald-500" : "bg-red-500"} animate-pulse`} />
      </div>

      {error && (
        <div className="fixed top-3 left-3 right-12 z-50 bg-red-500/20 border border-red-500/50 text-red-400 px-4 py-2 rounded-xl text-sm">
          {error}
        </div>
      )}

      <AnimatePresence mode="wait">
        {/* JOIN PHASE */}
        {!joined && (
          <motion.div
            key="join"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center p-6"
          >
            <h1 className="text-4xl font-extrabold gradient-text mb-2">Serata Quiz</h1>
            <p className="text-slate-400 mb-8">Partita: {joinCode}</p>

            <form onSubmit={handleJoin} className="w-full max-w-sm space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Nome della squadra
                </label>
                <input
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  required
                  maxLength={50}
                  className="w-full px-4 py-4 rounded-xl bg-slate-800 border border-slate-700 text-white text-lg placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  placeholder="Il vostro nome"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Foto squadra (opzionale)
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600 transition-all text-left"
                >
                  {photoUrl ? "Foto caricata ✓" : "Carica una foto..."}
                </button>
                {photoUrl && (
                  <img src={photoUrl} alt="Preview" className="w-16 h-16 rounded-full object-cover mx-auto mt-3 border-2 border-purple-500" />
                )}
              </div>

              <button
                type="submit"
                disabled={joining || !teamName.trim() || !isConnected}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 text-white font-bold text-xl shadow-lg hover:shadow-pink-500/25 transition-all disabled:opacity-50"
              >
                {joining ? "Accesso..." : "Unisciti!"}
              </button>
            </form>
          </motion.div>
        )}

        {/* LOBBY PHASE (after joining) */}
        {joined && gameState.phase === "lobby" && (
          <motion.div
            key="lobby"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center p-6"
          >
            <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-6" />
            <h2 className="text-2xl font-bold mb-2">In attesa...</h2>
            <p className="text-slate-400 text-center">
              In attesa che l&apos;host avvii la partita
            </p>

            <div className="mt-8 w-full max-w-sm">
              <p className="text-sm text-slate-500 mb-3">Squadre collegate:</p>
              <div className="space-y-2">
                {gameState.teams.map((team) => (
                  <div key={team.id} className="bg-slate-800 border border-slate-700 rounded-xl p-3 flex items-center gap-3">
                    {team.photoUrl ? (
                      <img src={team.photoUrl} alt={team.name} className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center text-white font-bold text-sm">
                        {team.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="font-medium">{team.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* READ PHASE */}
        {joined && gameState.phase === "read" && gameState.question && (
          <motion.div
            key="read"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col p-4"
          >
            <div className="text-center mb-4">
              <span className="text-slate-400 text-sm">
                Manche {gameState.question.roundNumber} - Domanda {gameState.question.position}/{gameState.question.totalQuestions}
              </span>
            </div>

            <div className={`text-5xl font-bold font-mono text-center mb-4 ${seconds <= 3 ? "text-red-500 animate-pulse" : "text-white"}`}>
              {seconds}
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 mb-4">
              <h2 className="text-xl font-bold text-center">{gameState.question.text}</h2>
            </div>

            <div className="grid grid-cols-1 gap-3 flex-1">
              {gameState.question.choices.map((choice, i) => (
                <div
                  key={i}
                  className={`${choiceColors[i].split(" ")[0]} rounded-xl p-4 text-white text-lg font-semibold text-center opacity-60`}
                >
                  {choice}
                </div>
              ))}
            </div>

            <p className="text-center text-slate-400 text-sm mt-4 animate-pulse">
              Preparati a rispondere...
            </p>
          </motion.div>
        )}

        {/* ANSWER PHASE */}
        {joined && gameState.phase === "answer" && gameState.question && (
          <motion.div
            key="answer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col p-4"
          >
            <div className={`text-5xl font-bold font-mono text-center mb-4 ${seconds <= 3 ? "text-red-500 animate-pulse" : "text-white"}`}>
              {seconds}
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 mb-4">
              <h2 className="text-lg font-bold text-center">{gameState.question.text}</h2>
            </div>

            {selectedAnswer !== null ? (
              <div className="flex-1 flex items-center justify-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="text-center"
                >
                  <div className={`w-24 h-24 rounded-full ${choiceColors[selectedAnswer].split(" ")[0]} flex items-center justify-center mx-auto mb-4`}>
                    <span className="text-4xl text-white font-bold">&#x2713;</span>
                  </div>
                  <p className="text-lg font-semibold">Risposta inviata!</p>
                  <p className="text-slate-400 text-sm mt-1">In attesa degli altri...</p>
                </motion.div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 flex-1">
                {gameState.question.choices.map((choice, i) => (
                  <motion.button
                    key={i}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleAnswer(i)}
                    className={`${choiceColors[i]} rounded-xl p-5 text-white text-xl font-bold text-center shadow-lg min-h-[70px] transition-all`}
                  >
                    {choice}
                  </motion.button>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* RESULTS PHASE */}
        {joined && gameState.phase === "results" && (
          <motion.div
            key="results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center p-6"
          >
            {myRanking ? (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center"
              >
                <div className={`w-28 h-28 rounded-full flex items-center justify-center mx-auto mb-4 ${
                  myRanking.isCorrect
                    ? "bg-emerald-500 shadow-lg shadow-emerald-500/30"
                    : "bg-red-500 shadow-lg shadow-red-500/30"
                }`}>
                  <span className="text-5xl text-white">
                    {myRanking.isCorrect ? "\u2713" : "\u2717"}
                  </span>
                </div>

                <h2 className="text-2xl font-bold mb-2">
                  {myRanking.isCorrect ? "Corretto!" : "Sbagliato!"}
                </h2>

                <p className="text-3xl font-bold text-purple-400 mb-1">
                  +{myRanking.questionScore}
                </p>
                <p className="text-slate-400 mb-6">
                  Totale: {myRanking.totalScore} punti
                </p>

                {myPosition !== undefined && myPosition !== -1 && (
                  <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                    <p className="text-slate-400 text-sm">Posizione</p>
                    <p className="text-3xl font-bold">{myPosition + 1}&deg;</p>
                  </div>
                )}
              </motion.div>
            ) : (
              <p className="text-slate-400">In attesa dei risultati...</p>
            )}
          </motion.div>
        )}

        {/* ROUND-END PHASE */}
        {joined && gameState.phase === "round-end" && (
          <motion.div
            key="round-end"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center p-6"
          >
            <div className="w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mb-6" />
            <h2 className="text-2xl font-bold gradient-text mb-2">Classifica in corso...</h2>
            <p className="text-slate-400 text-center">
              Guarda lo schermo dell&apos;host!
            </p>
          </motion.div>
        )}

        {/* FINISHED PHASE */}
        {joined && gameState.phase === "finished" && (
          <motion.div
            key="finished"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center p-6"
          >
            <motion.h1
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 150 }}
              className="text-3xl font-extrabold gradient-text mb-8 text-center"
            >
              Partita Terminata!
            </motion.h1>

            <div className="w-full max-w-sm space-y-3">
              {gameState.rankings?.map((entry, i) => {
                const isMe = entry.teamId === myTeamId;
                const isFirst = i === 0;
                return (
                  <motion.div
                    key={entry.teamId}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className={`flex items-center gap-3 p-4 rounded-xl border ${
                      isMe
                        ? "bg-purple-500/20 border-purple-500/50 ring-2 ring-purple-500"
                        : "bg-slate-800 border-slate-700"
                    }`}
                  >
                    <span className={`text-2xl font-extrabold ${
                      isFirst ? "text-amber-400" : "text-slate-500"
                    }`}>
                      {i + 1}
                    </span>
                    <span className="flex-1 font-medium">{entry.teamName}</span>
                    <span className="text-lg font-bold text-purple-400">{entry.totalScore}</span>
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
