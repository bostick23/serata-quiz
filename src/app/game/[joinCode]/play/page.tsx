"use client";

import { use, useEffect, useState, useRef, useSyncExternalStore } from "react";
import { useSocket } from "@/hooks/use-socket";
import { useGameState } from "@/hooks/use-game-state";
import { useCountdown } from "@/hooks/use-countdown";
import { motion, AnimatePresence } from "framer-motion";
import { getCategoryImage } from "@/lib/category-images";
import { AdBanner } from "@/components/ad-banner";
import { clearTeamSession, loadTeamSession, saveTeamSession } from "@/lib/team-session";
import { MAX_JOIN_ATTEMPTS, retryDelayMs } from "@/lib/retry";
import type { JoinAck } from "@/types/socket-events";

interface Props {
  params: Promise<{ joinCode: string }>;
}

const noopSubscribe = () => () => {};

export default function PlayPage({ params }: Props) {
  const { joinCode } = use(params);
  const { socket, isConnected } = useSocket();
  const { gameState, deadline, error, rankingsRevealed, setError } = useGameState(socket);
  const { seconds } = useCountdown(deadline ?? null);

  const [teamName, setTeamName] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [answer, setAnswer] = useState<{ gameQuestionId: string; index: number } | null>(null);
  const [myTeamId, setMyTeamId] = useState<string | null>(null);
  const [, forceRender] = useState(0);
  const [rejoinNonce, setRejoinNonce] = useState(0);
  const [rejoinFailed, setRejoinFailed] = useState(false);
  const forceRejoinRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Read on every render (cheap); the server snapshot keeps hydration consistent.
  const hasStoredSession = useSyncExternalStore(noopSubscribe, () => loadTeamSession(joinCode) !== null, () => false);

  // The chosen answer belongs to one question: a new question resets it without an effect.
  const selectedAnswer = answer && answer.gameQuestionId === gameState.question?.gameQuestionId ? answer.index : null;

  function applyJoinAck(res: JoinAck, fallbackName: string) {
    if (res.ok) {
      saveTeamSession(joinCode, { teamId: res.teamId, teamName: res.teamName, rejoinToken: res.rejoinToken });
      setMyTeamId(res.teamId);
      setTeamName(res.teamName);
      setJoined(true);
      setRejoinFailed(false);
      setError(null);
      return;
    }
    if (res.code !== "server-error") clearTeamSession(joinCode);
    setJoined(false);
    setTeamName(fallbackName);
    setError(res.error);
    forceRender(n => n + 1);
  }

  // (Re)join automatically on every (re)connection with the stored rejoin token:
  // covers page refreshes and reconnections the server could not recover by itself.
  // Transient failures (server error, no answer) are retried with backoff; after that the form is re-enabled.
  useEffect(() => {
    if (!socket || !isConnected) return;
    const forced = forceRejoinRef.current;
    forceRejoinRef.current = false;
    // Socket.io restored room membership and missed events by itself.
    if (socket.recovered && joined && !forced) return;
    const session = loadTeamSession(joinCode);
    if (!session) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const attempt = async (n: number) => {
      try {
        const res = await socket
          .timeout(10_000)
          .emitWithAck("game:join", { joinCode, teamName: session.teamName, rejoinToken: session.rejoinToken });
        if (cancelled) return;
        if (res.ok || res.code !== "server-error") {
          applyJoinAck(res, session.teamName);
          return;
        }
      } catch {
        if (cancelled) return;
      }
      if (n + 1 >= MAX_JOIN_ATTEMPTS) {
        setJoined(false);
        setTeamName(session.teamName);
        setRejoinFailed(true);
        return;
      }
      timer = setTimeout(() => void attempt(n + 1), retryDelayMs(n));
    };
    void attempt(0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only on connection changes or explicit retries
  }, [socket, isConnected, joinCode, rejoinNonce]);

  function requestRejoin() {
    forceRejoinRef.current = true;
    setRejoinFailed(false);
    setRejoinNonce(n => n + 1);
  }

  // Another device took over this team (e.g. a teammate reclaimed it): back to the join form.
  useEffect(() => {
    if (!socket) return;
    const onReplaced = ({ message }: { message: string }) => {
      clearTeamSession(joinCode);
      setJoined(false);
      setMyTeamId(null);
      setError(message);
    };
    socket.on("team:replaced", onReplaced);
    return () => {
      socket.off("team:replaced", onReplaced);
    };
  }, [socket, joinCode, setError]);

  // A cancelled game cannot be rejoined: forget the stored team.
  useEffect(() => {
    if (gameState.phase === "cancelled") clearTeamSession(joinCode);
  }, [gameState.phase, joinCode]);

  // Errors are transient notices: hide them after a few seconds.
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 6_000);
    return () => clearTimeout(timer);
  }, [error, setError]);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!socket || !isConnected || !teamName.trim() || joining) return;
    setJoining(true);
    try {
      const rejoinToken = loadTeamSession(joinCode)?.rejoinToken;
      const res = await socket.timeout(10_000).emitWithAck("game:join", { joinCode, teamName, photoUrl, rejoinToken });
      applyJoinAck(res, teamName);
    } catch {
      setError("Il server non risponde, riprova.");
    } finally {
      setJoining(false);
    }
  }

  function handleJoinAsNewTeam() {
    clearTeamSession(joinCode);
    setRejoinFailed(false);
    forceRender(n => n + 1);
  }

  async function handleAnswer(chosenIndex: number) {
    if (!socket || !gameState.question || selectedAnswer !== null) return;
    const gameQuestionId = gameState.question.gameQuestionId;
    setAnswer({ gameQuestionId, index: chosenIndex });
    try {
      const res = await socket.timeout(5_000).emitWithAck("answer:submit", { joinCode, gameQuestionId, chosenIndex });
      if (res.ok) return;
      if (res.reason === "not-joined") {
        // The server no longer binds this connection to the team: rejoin, then the player can answer again.
        setAnswer(null);
        setError("Connessione persa: ricollegamento in corso, poi riprova a rispondere.");
        requestRejoin();
      } else if (res.reason === "wrong-phase" || res.reason === "stale-question") {
        setError("Tempo scaduto: risposta non registrata.");
      }
    } catch {
      setError("Connessione instabile: risposta non confermata.");
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImage(file, 128, 0.6);
      setPhotoUrl(compressed);
    } catch (err) {
      console.error("[Play] Photo compression failed:", err);
      // Continue without photo rather than blocking
      setPhotoUrl(null);
    }
  }

  function compressImage(file: File, maxSize: number, quality: number): Promise<string> {
    return new Promise((resolve, reject) => {
      // Timeout: if compression takes >5s (iOS HEIC decoding issues), reject
      const timeout = setTimeout(() => reject(new Error("Compression timeout")), 5000);

      const img = new Image();
      img.onload = () => {
        clearTimeout(timeout);
        try {
          const canvas = document.createElement("canvas");
          let w = img.width;
          let h = img.height;
          if (w > h) {
            if (w > maxSize) { h = Math.round(h * maxSize / w); w = maxSize; }
          } else {
            if (h > maxSize) { w = Math.round(w * maxSize / h); h = maxSize; }
          }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) { reject(new Error("Canvas not supported")); return; }
          ctx.drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL("image/jpeg", quality);
          URL.revokeObjectURL(img.src);
          resolve(dataUrl);
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => {
        clearTimeout(timeout);
        URL.revokeObjectURL(img.src);
        reject(new Error("Failed to load image"));
      };
      img.src = URL.createObjectURL(file);
    });
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

            {hasStoredSession && (
              <div className="w-full max-w-sm mb-6 bg-slate-800 border border-slate-700 rounded-xl p-4 text-center">
                {rejoinFailed ? (
                  <>
                    <p className="text-slate-300 text-sm">Non riesco a ricollegarti alla tua squadra.</p>
                    <button type="button" onClick={requestRejoin} className="mt-2 px-4 py-1.5 rounded-lg bg-purple-600 text-white text-sm font-semibold">
                      Riprova
                    </button>
                  </>
                ) : (
                  <>
                    <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-slate-300 text-sm">Riconnessione alla tua squadra…</p>
                  </>
                )}
                <button type="button" onClick={handleJoinAsNewTeam} className="mt-2 block mx-auto text-xs text-slate-400 underline hover:text-white">
                  Entra con un&apos;altra squadra
                </button>
              </div>
            )}

            <form onSubmit={handleJoin} className="w-full max-w-sm space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Nome della squadra
                </label>
                <input
                  value={teamName}
                  onChange={(e) => { setTeamName(e.target.value); setError(null); }}
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
                disabled={joining || (hasStoredSession && !rejoinFailed) || !teamName.trim() || !isConnected}
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

            <AdBanner className="mt-6 max-w-sm" />
          </motion.div>
        )}

        {/* CATEGORY PHASE */}
        {joined && gameState.phase === "category" && gameState.categoryName && (
          <motion.div
            key="category"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center p-4"
          >
            <div className="text-slate-400 text-sm mb-4">
              Domanda {gameState.currentQuestion}/{gameState.numQuestions}
            </div>

            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
              className="mb-4"
            >
              <img
                src={getCategoryImage(gameState.categoryName)}
                alt={gameState.categoryName}
                className="w-24 h-24"
              />
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-3xl font-extrabold text-center gradient-text mb-6"
            >
              {gameState.categoryName}
            </motion.h1>

            <div className={`text-4xl font-bold font-mono ${seconds <= 2 ? "text-red-500 animate-pulse" : "text-slate-500"}`}>
              {seconds}
            </div>

            <p className="text-slate-400 mt-4 animate-pulse">Preparati...</p>
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
                Domanda {gameState.question.position}/{gameState.question.totalQuestions}
              </span>
            </div>

            <div className={`text-5xl font-bold font-mono text-center mb-4 ${seconds <= 3 ? "text-red-500 animate-pulse" : "text-white"}`}>
              {seconds}
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 mb-4">
              <h2 className="text-xl font-bold text-center">{gameState.question.text}</h2>
            </div>

            <div className="flex-1 flex items-center justify-center">
              <p className="text-lg text-slate-400 animate-pulse">
                Preparati a rispondere...
              </p>
            </div>
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
              <div className="flex-1 flex flex-col items-center justify-center">
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
                  {myRanking.questionScore > 0 ? "+" : ""}{myRanking.questionScore}
                </p>
                <p className="text-slate-400 mb-6">
                  Totale: {myRanking.totalScore} punti
                </p>

                {myPosition !== undefined && myPosition !== -1 && !gameState.isLastQuestion && (
                  <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                    <p className="text-slate-400 text-sm">Posizione</p>
                    <p className="text-3xl font-bold">{myPosition + 1}&deg;</p>
                  </div>
                )}
              </motion.div>
            ) : (
              <p className="text-slate-400">In attesa dei risultati...</p>
            )}

            <AdBanner className="mt-6 max-w-sm" />
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

            {!rankingsRevealed ? (
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-slate-400 text-center animate-pulse">
                  Guarda lo schermo per la classifica...
                </p>
              </div>
            ) : (
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
            )}
          </motion.div>
        )}
        {/* CANCELLED PHASE */}
        {gameState.phase === "cancelled" && (
          <motion.div
            key="cancelled"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className="text-center"
            >
              <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6">
                <span className="text-4xl text-red-400">✕</span>
              </div>
              <h2 className="text-2xl font-bold text-red-400 mb-3">Partita Annullata</h2>
              <p className="text-slate-400">
                L&apos;host ha annullato la partita.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
