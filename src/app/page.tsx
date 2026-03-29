"use client";

import Link from "next/link";
import { motion } from "framer-motion";

const features = [
  {
    icon: "🎮",
    title: "Crea partite in secondi",
    description:
      "Imposta una sessione di gioco, condividi il codice o il QR code e inizia a divertirti con i tuoi amici.",
  },
  {
    icon: "👥",
    title: "Gioco a squadre",
    description:
      "I partecipanti si uniscono in squadre, caricano la propria foto e competono in tempo reale per aggiudicarsi il punteggio più alto.",
  },
  {
    icon: "⚡",
    title: "Risposte in tempo reale",
    description:
      "Ogni risposta viene registrata istantaneamente. La classifica si aggiorna dopo ogni domanda per mantenere alta la tensione.",
  },
  {
    icon: "📋",
    title: "Domande personalizzabili",
    description:
      "Aggiungi le tue domande o usa il nostro archivio per creare quiz su misura per ogni occasione.",
  },
  {
    icon: "📱",
    title: "Funziona su tutti i dispositivi",
    description:
      "I giocatori usano il proprio smartphone, mentre il conduttore gestisce tutto da PC o tablet.",
  },
  {
    icon: "🏆",
    title: "Classifica dinamica",
    description:
      "Visualizza i risultati live con una classifica animata che tiene tutti col fiato sospeso fino all'ultima domanda.",
  },
];

const steps = [
  {
    num: "1",
    title: "Crea un account",
    desc: "Registrati gratuitamente e accedi alla dashboard per gestire le tue partite.",
  },
  {
    num: "2",
    title: "Avvia una partita",
    desc: "Scegli le domande, genera il codice di gioco e condividilo con i tuoi ospiti.",
  },
  {
    num: "3",
    title: "I team si uniscono",
    desc: "Ogni squadra scansiona il QR code o inserisce il codice per entrare nella stanza.",
  },
  {
    num: "4",
    title: "Gioca e vinci!",
    desc: "Il conduttore avvia le domande, i team rispondono e la classifica si aggiorna in diretta.",
  },
];

export default function HomePage() {
  return (
    <main className="flex-1 flex flex-col">
      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center px-4 py-20 sm:py-28 text-center relative overflow-hidden">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="text-5xl mb-4"
          >
            🎉
          </motion.div>
          <h1 className="text-6xl sm:text-8xl font-extrabold gradient-text mb-6">
            Serata Quiz
          </h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="text-xl sm:text-2xl text-slate-300 mb-4"
          >
            Il quiz show interattivo per le tue serate!
          </motion.p>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.45, duration: 0.5 }}
            className="text-base sm:text-lg text-slate-400 mb-10 max-w-xl mx-auto"
          >
            Organizza quiz live con amici, colleghi o clienti. Crea domande
            personalizzate, gestisci le squadre e tieni tutti incollati allo
            schermo con classifiche in tempo reale.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link
              href="/register"
              className="px-8 py-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 text-white font-semibold text-lg shadow-lg hover:shadow-pink-500/25 hover:scale-105 transition-all duration-200"
            >
              Inizia gratis
            </Link>
            <Link
              href="/login"
              className="px-8 py-4 rounded-xl border-2 border-purple-500 text-white font-semibold text-lg hover:bg-purple-500/10 hover:scale-105 transition-all duration-200"
            >
              Accedi
            </Link>
          </motion.div>
        </motion.div>

        {/* Decorative background elements */}
        <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 -left-20 w-72 h-72 bg-purple-600/20 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 -right-20 w-72 h-72 bg-pink-500/20 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
        </div>
      </section>

      {/* Features Section */}
      <section className="px-4 py-16 sm:py-20">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">
              Tutto quello che ti serve
            </h2>
            <p className="text-slate-400 text-lg">
              Un&apos;esperienza di gioco completa, direttamente dal browser.
            </p>
          </motion.div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.4 }}
                className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 hover:border-purple-500/50 transition-colors duration-200"
              >
                <div className="text-3xl mb-3">{feature.icon}</div>
                <h3 className="text-white font-semibold text-lg mb-2">
                  {feature.title}
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works Section */}
      <section className="px-4 py-16 sm:py-20 bg-slate-800/30">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">
              Come funziona
            </h2>
            <p className="text-slate-400 text-lg">
              In pochi passi sei pronto a giocare.
            </p>
          </motion.div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {steps.map((step, i) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, x: i % 2 === 0 ? -20 : 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.4 }}
                className="flex gap-4 items-start"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center font-bold text-white text-lg">
                  {step.num}
                </div>
                <div>
                  <h3 className="text-white font-semibold text-lg mb-1">
                    {step.title}
                  </h3>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-4 py-16 sm:py-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="max-w-2xl mx-auto"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Pronto a iniziare?
          </h2>
          <p className="text-slate-400 text-lg mb-8">
            Crea il tuo primo quiz in pochi minuti. Nessuna carta di credito
            richiesta.
          </p>
          <Link
            href="/register"
            className="inline-block px-10 py-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 text-white font-semibold text-lg shadow-lg hover:shadow-pink-500/25 hover:scale-105 transition-all duration-200"
          >
            Crea il tuo account gratuito
          </Link>
        </motion.div>
      </section>
    </main>
  );
}
