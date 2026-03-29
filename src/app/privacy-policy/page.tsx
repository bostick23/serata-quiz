import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | Serata Quiz",
  description: "Informativa sul trattamento dei dati personali di Serata Quiz.",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="flex-1 px-4 py-12">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-8 text-sm"
        >
          ← Torna alla home
        </Link>

        <h1 className="text-4xl font-extrabold gradient-text mb-2">
          Privacy Policy
        </h1>
        <p className="text-slate-400 text-sm mb-10">
          Ultimo aggiornamento: marzo 2025
        </p>

        <div className="space-y-10 text-slate-300 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">
              1. Titolare del trattamento
            </h2>
            <p>
              Il titolare del trattamento dei dati personali raccolti tramite
              questa applicazione è l&apos;operatore del sito <strong>Serata Quiz</strong>.
              Per qualsiasi domanda relativa alla presente informativa è possibile
              contattarci all&apos;indirizzo e-mail indicato nella sezione{" "}
              <em>Contatti</em>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">
              2. Dati raccolti
            </h2>
            <p className="mb-3">
              Durante l&apos;utilizzo di Serata Quiz vengono raccolti i seguenti dati:
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-400">
              <li>
                <strong className="text-slate-300">Dati di registrazione:</strong>{" "}
                indirizzo e-mail e password (conservata in forma cifrata con
                bcrypt) forniti al momento della creazione dell&apos;account.
              </li>
              <li>
                <strong className="text-slate-300">Dati di sessione:</strong>{" "}
                token di sessione generati da NextAuth per mantenere l&apos;utente
                autenticato durante la navigazione.
              </li>
              <li>
                <strong className="text-slate-300">Foto del team:</strong>{" "}
                immagini caricate volontariamente dai partecipanti per
                identificare la propria squadra durante la partita.
              </li>
              <li>
                <strong className="text-slate-300">Dati di utilizzo:</strong>{" "}
                informazioni sulle partite create, sulle domande inserite e
                sui punteggi ottenuti.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">
              3. Finalità del trattamento
            </h2>
            <p className="mb-3">I dati sono trattati per le seguenti finalità:</p>
            <ul className="list-disc list-inside space-y-2 text-slate-400">
              <li>Creazione e gestione dell&apos;account utente.</li>
              <li>Erogazione del servizio di quiz interattivo in tempo reale.</li>
              <li>Miglioramento dell&apos;esperienza utente e funzionalità dell&apos;applicazione.</li>
              <li>Adempimento di obblighi di legge.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">
              4. Cookie e tecnologie simili
            </h2>
            <p className="mb-3">
              Serata Quiz utilizza esclusivamente cookie tecnici essenziali,
              necessari per il corretto funzionamento del servizio. Non vengono
              utilizzati cookie di profilazione o di tracciamento di terze parti.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-2 pr-4 text-white font-semibold">
                      Cookie
                    </th>
                    <th className="text-left py-2 pr-4 text-white font-semibold">
                      Tipo
                    </th>
                    <th className="text-left py-2 text-white font-semibold">
                      Scopo
                    </th>
                  </tr>
                </thead>
                <tbody className="text-slate-400">
                  <tr className="border-b border-slate-800">
                    <td className="py-2 pr-4 font-mono text-xs">
                      next-auth.session-token
                    </td>
                    <td className="py-2 pr-4">Tecnico / Essenziale</td>
                    <td className="py-2">
                      Mantiene la sessione autenticata dell&apos;utente.
                    </td>
                  </tr>
                  <tr className="border-b border-slate-800">
                    <td className="py-2 pr-4 font-mono text-xs">
                      next-auth.csrf-token
                    </td>
                    <td className="py-2 pr-4">Tecnico / Sicurezza</td>
                    <td className="py-2">
                      Protegge le richieste da attacchi CSRF.
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-mono text-xs">
                      cookie_consent
                    </td>
                    <td className="py-2 pr-4">Tecnico / Preferenze</td>
                    <td className="py-2">
                      Memorizza la preferenza dell&apos;utente riguardo al banner
                      cookie.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-slate-400 text-sm">
              I cookie tecnici non richiedono consenso preventivo ai sensi
              dell&apos;art. 122 del Codice Privacy e delle Linee Guida del Garante
              Privacy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">
              5. Base giuridica del trattamento
            </h2>
            <p>
              Il trattamento dei dati personali è effettuato sulla base del
              consenso dell&apos;interessato (art. 6, par. 1, lett. a GDPR) fornito al
              momento della registrazione, nonché per l&apos;esecuzione del contratto
              di servizio (art. 6, par. 1, lett. b GDPR).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">
              6. Conservazione dei dati
            </h2>
            <p>
              I dati personali sono conservati per il tempo strettamente
              necessario alle finalità per cui sono stati raccolti, e comunque
              non oltre la cancellazione dell&apos;account da parte dell&apos;utente. I
              dati di sessione scadono automaticamente al termine della sessione
              o entro il periodo di validità del token.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">
              7. Diritti degli interessati
            </h2>
            <p className="mb-3">
              In conformità al Regolamento UE 2016/679 (GDPR), l&apos;utente ha
              diritto di:
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-400">
              <li>accedere ai propri dati personali;</li>
              <li>richiederne la rettifica o la cancellazione;</li>
              <li>opporsi al trattamento o richiederne la limitazione;</li>
              <li>richiedere la portabilità dei dati;</li>
              <li>revocare il consenso in qualsiasi momento;</li>
              <li>
                proporre reclamo all&apos;autorità di controllo (Garante per la
                Protezione dei Dati Personali,{" "}
                <a
                  href="https://www.garanteprivacy.it"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-400 hover:text-purple-300 underline"
                >
                  www.garanteprivacy.it
                </a>
                ).
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">
              8. Sicurezza dei dati
            </h2>
            <p>
              Adottiamo misure tecniche e organizzative adeguate per proteggere
              i dati personali da accessi non autorizzati, perdita o
              divulgazione. Le password vengono cifrate con l&apos;algoritmo bcrypt
              prima di essere archiviate nel database.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">
              9. Modifiche alla presente informativa
            </h2>
            <p>
              Ci riserviamo il diritto di aggiornare questa informativa in
              qualsiasi momento. Le modifiche saranno pubblicate su questa
              pagina con l&apos;aggiornamento della data in cima al documento.
              L&apos;utilizzo continuato del servizio dopo la pubblicazione delle
              modifiche costituisce accettazione delle stesse.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">
              10. Contatti
            </h2>
            <p>
              Per esercitare i diritti sopra indicati o per qualsiasi
              informazione relativa al trattamento dei tuoi dati personali,
              puoi contattarci tramite la sezione di supporto dell&apos;applicazione.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
