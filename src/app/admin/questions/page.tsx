"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

interface Question {
  id: string;
  text: string;
  choices: string[];
  correctIndex: number;
  category: string | null;
  createdAt: string;
}

export default function AdminQuestionsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Form state
  const [text, setText] = useState("");
  const [choices, setChoices] = useState(["", "", "", ""]);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [category, setCategory] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") fetchQuestions();
  }, [status]);

  async function fetchQuestions() {
    try {
      const res = await fetch("/api/admin/questions");
      if (res.ok) {
        setQuestions(await res.json());
      }
    } catch {
      console.error("Failed to fetch questions");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setText("");
    setChoices(["", "", "", ""]);
    setCorrectIndex(0);
    setCategory("");
    setEditingId(null);
    setShowForm(false);
    setError("");
  }

  function startEdit(q: Question) {
    setText(q.text);
    setChoices([...q.choices]);
    setCorrectIndex(q.correctIndex);
    setCategory(q.category || "");
    setEditingId(q.id);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    if (choices.some((c) => c.trim() === "")) {
      setError("Tutte le risposte devono essere compilate");
      setSaving(false);
      return;
    }

    try {
      const url = editingId ? `/api/admin/questions/${editingId}` : "/api/admin/questions";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          choices,
          correctIndex,
          category: category || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Errore nel salvataggio");
        return;
      }

      resetForm();
      fetchQuestions();
    } catch {
      setError("Errore nel salvataggio");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Sei sicuro di voler eliminare questa domanda?")) return;

    try {
      const res = await fetch(`/api/admin/questions/${id}`, { method: "DELETE" });
      if (res.ok) {
        setQuestions((prev) => prev.filter((q) => q.id !== id));
      }
    } catch {
      console.error("Failed to delete question");
    }
  }

  // Check if user is admin
  if (status === "authenticated" && (session?.user as { role?: string })?.role !== "admin") {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="bg-slate-800 border border-red-500/30 rounded-2xl p-8 text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl text-red-400">&#x2717;</span>
          </div>
          <h1 className="text-2xl font-bold text-red-400 mb-2">Accesso negato</h1>
          <p className="text-slate-400 mb-6">Non hai i permessi per accedere a questa pagina.</p>
          <Link
            href="/dashboard"
            className="px-6 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white transition-colors inline-block"
          >
            Torna alla Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      <header className="border-b border-slate-700 bg-slate-800/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-slate-400 hover:text-white transition-colors">
              &larr; Dashboard
            </Link>
            <h1 className="text-xl font-bold">
              <span className="gradient-text">Admin</span> - Domande globali
            </h1>
          </div>
          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 text-white font-semibold text-sm shadow-lg hover:shadow-pink-500/25 transition-all"
          >
            Aggiungi domanda
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-8 overflow-hidden"
            >
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
                <h2 className="text-lg font-semibold mb-4">
                  {editingId ? "Modifica domanda globale" : "Nuova domanda globale"}
                </h2>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-xl mb-4 text-sm">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">
                      Domanda
                    </label>
                    <textarea
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      required
                      rows={2}
                      className="w-full px-4 py-3 rounded-xl bg-slate-700 border border-slate-600 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all resize-none"
                      placeholder="Scrivi la domanda..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">
                      Categoria (opzionale)
                    </label>
                    <input
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-slate-700 border border-slate-600 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                      placeholder="Es. Geografia, Sport, Cinema..."
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-slate-300">
                      Risposte (seleziona quella corretta)
                    </label>
                    {choices.map((choice, i) => {
                      const colors = ["border-red-500", "border-blue-500", "border-emerald-500", "border-amber-500"];
                      return (
                        <div key={i} className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setCorrectIndex(i)}
                            className={`w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                              correctIndex === i
                                ? "bg-emerald-500 border-emerald-500 text-white"
                                : `${colors[i]} text-slate-400 hover:text-white`
                            }`}
                          >
                            {correctIndex === i ? "\u2713" : i + 1}
                          </button>
                          <input
                            value={choice}
                            onChange={(e) => {
                              const updated = [...choices];
                              updated[i] = e.target.value;
                              setChoices(updated);
                            }}
                            required
                            className={`flex-1 px-4 py-2.5 rounded-xl bg-slate-700 border text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all ${colors[i]}`}
                            placeholder={`Risposta ${i + 1}`}
                          />
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 text-white font-semibold shadow-lg hover:shadow-pink-500/25 transition-all disabled:opacity-50"
                    >
                      {saving ? "Salvataggio..." : editingId ? "Salva modifiche" : "Aggiungi"}
                    </button>
                    <button
                      type="button"
                      onClick={resetForm}
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

        {questions.length === 0 ? (
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-12 text-center">
            <p className="text-slate-400 text-lg">
              Nessuna domanda globale. Aggiungi la prima domanda!
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {questions.map((q) => (
              <motion.div
                key={q.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-800 border border-slate-700 rounded-xl p-5 hover:border-slate-600 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    {q.category && (
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 mb-2">
                        {q.category}
                      </span>
                    )}
                    <p className="font-medium mb-3">{q.text}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {q.choices.map((choice, i) => {
                        const bgColors = ["bg-red-500/10", "bg-blue-500/10", "bg-emerald-500/10", "bg-amber-500/10"];
                        const borderColors = ["border-red-500/30", "border-blue-500/30", "border-emerald-500/30", "border-amber-500/30"];
                        return (
                          <div
                            key={i}
                            className={`px-3 py-2 rounded-lg text-sm border ${bgColors[i]} ${borderColors[i]} ${
                              i === q.correctIndex ? "ring-2 ring-emerald-500 font-semibold" : ""
                            }`}
                          >
                            {choice}
                            {i === q.correctIndex && (
                              <span className="ml-2 text-emerald-400">&#x2713;</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => startEdit(q)}
                      className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm transition-colors"
                    >
                      Modifica
                    </button>
                    <button
                      onClick={() => handleDelete(q.id)}
                      className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm transition-colors"
                    >
                      Elimina
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
