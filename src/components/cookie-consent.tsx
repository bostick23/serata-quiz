"use client";

import { useSyncExternalStore, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

const CONSENT_KEY = "cookie_consent";
// Stored values: "accepted" | "declined"

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getSnapshot() {
  return localStorage.getItem(CONSENT_KEY);
}

function getServerSnapshot() {
  return null;
}

export function CookieConsent() {
  const consent = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const handleAccept = useCallback(() => {
    localStorage.setItem(CONSENT_KEY, "accepted");
    // Dispatch a storage event so useSyncExternalStore re-reads the value
    window.dispatchEvent(new StorageEvent("storage", { key: CONSENT_KEY }));
  }, []);

  const handleDecline = useCallback(() => {
    localStorage.setItem(CONSENT_KEY, "declined");
    window.dispatchEvent(new StorageEvent("storage", { key: CONSENT_KEY }));
  }, []);

  const visible = consent === null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ duration: 0.35 }}
          role="dialog"
          aria-label="Consenso cookie"
          className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-50 bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-5"
        >
          <p className="text-sm text-slate-300 mb-4 leading-relaxed">
            🍪 Usiamo cookie tecnici essenziali per il funzionamento del sito e
            per mantenere la tua sessione. Non utilizziamo cookie di
            profilazione. Per saperne di più consulta la nostra{" "}
            <Link
              href="/privacy-policy"
              className="text-purple-400 hover:text-purple-300 underline"
            >
              Privacy Policy
            </Link>
            .
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleAccept}
              className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-500 text-white text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Accetta
            </button>
            <button
              onClick={handleDecline}
              className="flex-1 px-4 py-2 rounded-lg border border-slate-600 text-slate-300 text-sm font-semibold hover:bg-slate-700/50 transition-colors"
            >
              Rifiuta
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
