"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Errore durante l'elaborazione della richiesta");
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Errore durante l'elaborazione della richiesta");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 shadow-xl">
          {submitted ? (
            <>
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 mb-4">
                  <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">Email inviata</h1>
                <p className="text-slate-400">
                  Se esiste un account associato a <span className="text-white">{email}</span>, riceverai un codice per reimpostare la password.
                </p>
              </div>
              <Link
                href="/reset-password"
                className="block w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 text-white font-semibold text-lg shadow-lg hover:shadow-pink-500/25 hover:scale-[1.02] transition-all duration-200 text-center"
              >
                Inserisci il codice
              </Link>
              <p className="text-center text-slate-400 mt-4">
                <Link href="/login" className="text-purple-400 hover:text-purple-300 font-medium">
                  Torna al login
                </Link>
              </p>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-bold gradient-text mb-2 text-center">
                Recupero Password
              </h1>
              <p className="text-slate-400 text-center mb-8">
                Inserisci la tua email e ti invieremo un codice per reimpostare la password.
              </p>

              {error && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-xl mb-6 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1.5">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-xl bg-slate-700 border border-slate-600 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    placeholder="la-tua@email.com"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 text-white font-semibold text-lg shadow-lg hover:shadow-pink-500/25 hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {loading ? "Invio in corso..." : "Invia codice"}
                </button>
              </form>

              <p className="text-center text-slate-400 mt-6">
                <Link href="/login" className="text-purple-400 hover:text-purple-300 font-medium">
                  Torna al login
                </Link>
              </p>
            </>
          )}
        </div>
      </motion.div>
    </main>
  );
}
