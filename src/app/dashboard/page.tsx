"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

interface Game {
  id: string;
  joinCode: string;
  status: "lobby" | "playing" | "finished";
  numRounds: number;
  questionsPerRound: number;
  createdAt: string;
}

const statusColors: Record<string, string> = {
  lobby: "bg-amber-400/20 text-amber-400 border-amber-400/30",
  playing: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  finished: "bg-slate-500/20 text-slate-400 border-slate-500/30",
};

const statusLabels: Record<string, string> = {
  lobby: "In attesa",
  playing: "In corso",
  finished: "Terminata",
};

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [games, setGames] = useState<Game[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [numRounds, setNumRounds] = useState(3);
  const [questionsPerRound, setQuestionsPerRound] = useState(5);
  const [language, setLanguage] = useState<"it" | "en">("it");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [loadingGames, setLoadingGames] = useState(true);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    async function fetchGames() {
      try {
        const res = await fetch("/api/games");
        if (res.ok) {
          const data = await res.json();
          setGames(data);
        }
      } catch {
        console.error("Failed to fetch games");
      } finally {
        setLoadingGames(false);
      }
    }
    if (status === "authenticated") {
      fetchGames();
    }
  }, [status]);

  useEffect(() => {
    if (!showForm) return;
    async function fetchCategories() {
      try {
        const res = await fetch(`/api/questions/categories?language=${language}`);
        if (res.ok) {
          const data: string[] = await res.json();
          setAvailableCategories(data);
          setSelectedCategories(data);
        }
      } catch (error) {
        console.error("Failed to fetch categories:", error);
      }
    }
    fetchCategories();
  }, [language, showForm]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError("");

    if (availableCategories.length > 0 && selectedCategories.length === 0) {
      setError("Seleziona almeno una categoria nelle opzioni avanzate.");
      setCreating(false);
      return;
    }

    const allSelected = selectedCategories.length === availableCategories.length;
    const categories = allSelected ? undefined : selectedCategories;

    try {
      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numRounds, questionsPerRound, language, categories }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Errore nella creazione");
        return;
      }

      router.push(`/game/${data.joinCode}/host`);
    } catch {
      setError("Errore nella creazione della partita");
    } finally {
      setCreating(false);
    }
  }

  function handleCancel() {
    setShowForm(false);
    setShowAdvancedOptions(false);
  }

  if (status === "loading") {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (status === "unauthenticated") return null;

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700 bg-slate-800/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold gradient-text">Serata Quiz</h1>
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard/questions"
              className="text-slate-300 hover:text-white transition-colors text-sm"
            >
              Le mie domande
            </Link>
            <span className="text-slate-400 text-sm hidden sm:block">
              {session?.user?.name}
            </span>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm transition-colors"
            >
              Esci
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Create game section */}
        <div className="mb-8">
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 text-white font-semibold shadow-lg hover:shadow-pink-500/25 hover:scale-[1.02] transition-all duration-200"
          >
            Crea Nuova Partita
          </button>
        </div>

        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-8 overflow-hidden"
            >
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
                <h2 className="text-xl font-semibold mb-4">Nuova Partita</h2>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-xl mb-4 text-sm">
                    {error}
                  </div>
                )}

                <form onSubmit={handleCreate} className="space-y-4">
                  {/* Language selector */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Lingua delle domande
                    </label>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setLanguage("it")}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 transition-all ${
                          language === "it"
                            ? "border-purple-500 bg-purple-500/20 text-white"
                            : "border-slate-600 bg-slate-700 text-slate-400 hover:border-slate-500"
                        }`}
                      >
                        <span className="text-2xl">🇮🇹</span>
                        <span className="font-medium">Italiano</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setLanguage("en")}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 transition-all ${
                          language === "en"
                            ? "border-purple-500 bg-purple-500/20 text-white"
                            : "border-slate-600 bg-slate-700 text-slate-400 hover:border-slate-500"
                        }`}
                      >
                        <span className="text-2xl">🇬🇧</span>
                        <span className="font-medium">English</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="numRounds" className="block text-sm font-medium text-slate-300 mb-1.5">
                        Numero di manche (1-10)
                      </label>
                      <input
                        id="numRounds"
                        type="number"
                        min={1}
                        max={10}
                        value={numRounds}
                        onChange={(e) => setNumRounds(Number(e.target.value))}
                        className="w-full px-4 py-3 rounded-xl bg-slate-700 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                      />
                    </div>
                    <div>
                      <label htmlFor="questionsPerRound" className="block text-sm font-medium text-slate-300 mb-1.5">
                        Domande per manche (1-20)
                      </label>
                      <input
                        id="questionsPerRound"
                        type="number"
                        min={1}
                        max={20}
                        value={questionsPerRound}
                        onChange={(e) => setQuestionsPerRound(Number(e.target.value))}
                        className="w-full px-4 py-3 rounded-xl bg-slate-700 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                      />
                    </div>
                  </div>

                  <p className="text-slate-400 text-sm">
                    Totale domande necessarie: {numRounds * questionsPerRound}
                  </p>

                  {/* Advanced options */}
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                      className="flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300 transition-colors"
                    >
                      <span>{showAdvancedOptions ? "▾" : "▸"}</span>
                      Opzioni avanzate
                    </button>
                    <AnimatePresence>
                      {showAdvancedOptions && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-3 p-4 bg-slate-700/50 rounded-xl border border-slate-600">
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-sm font-medium text-slate-300">
                                Categorie
                              </span>
                              <div className="flex gap-3">
                                <button
                                  type="button"
                                  onClick={() => setSelectedCategories(availableCategories)}
                                  className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
                                >
                                  Seleziona tutte
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setSelectedCategories([])}
                                  className="text-xs text-slate-400 hover:text-slate-300 transition-colors"
                                >
                                  Deseleziona tutte
                                </button>
                              </div>
                            </div>
                            {availableCategories.length === 0 ? (
                              <p className="text-slate-400 text-sm">
                                Nessuna categoria disponibile per questa lingua.
                              </p>
                            ) : (
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {availableCategories.map((cat) => (
                                  <label
                                    key={cat}
                                    className="flex items-center gap-2 cursor-pointer group"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selectedCategories.includes(cat)}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setSelectedCategories((prev) => [...prev, cat]);
                                        } else {
                                          setSelectedCategories((prev) =>
                                            prev.filter((c) => c !== cat)
                                          );
                                        }
                                      }}
                                      className="w-4 h-4 rounded accent-purple-500"
                                    />
                                    <span className="text-sm text-slate-300 group-hover:text-white transition-colors truncate">
                                      {cat}
                                    </span>
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="submit"
                      disabled={creating}
                      className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 text-white font-semibold shadow-lg hover:shadow-pink-500/25 transition-all disabled:opacity-50"
                    >
                      {creating ? "Creazione..." : "Crea Partita"}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="px-6 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
                    >
                      Annulla
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Games list */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Le tue partite</h2>

          {loadingGames ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : games.length === 0 ? (
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-12 text-center">
              <p className="text-slate-400 text-lg">
                Nessuna partita ancora. Crea la tua prima partita!
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {games.map((game) => (
                <motion.div
                  key={game.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-slate-800 border border-slate-700 rounded-xl p-5 flex items-center justify-between hover:border-slate-600 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-2xl font-mono font-bold text-purple-400">
                      {game.joinCode}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${statusColors[game.status]}`}>
                          {statusLabels[game.status]}
                        </span>
                      </div>
                      <p className="text-slate-400 text-sm mt-1">
                        {game.numRounds} manche, {game.questionsPerRound} domande per manche
                      </p>
                      <p className="text-slate-500 text-xs mt-0.5">
                        {new Date(game.createdAt).toLocaleDateString("it-IT", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                  {game.status !== "finished" && (
                    <Link
                      href={`/game/${game.joinCode}/host`}
                      className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
                    >
                      Apri
                    </Link>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
