# Serata Quiz

Quiz a squadre in tempo reale: l'host proietta la partita su uno schermo grande, le squadre rispondono dal telefono.

## Architettura

- **Next.js 16** (App Router) servito da un **custom server** (`server.ts`) che ospita anche **Socket.io**.
- **Firestore** (firebase-admin) per utenti, archivio domande e storico partite. **NextAuth v5** (JWT) per il login degli host.
- **Stato della partita in memoria** (`src/lib/socket/game-manager.ts`). La logica di gioco è una macchina a stati pura e testata (`src/lib/socket/game-engine.ts`).
  Firestore viene scritto in background ("write-behind") e serve a riprendere le partite dopo un riavvio.

## Sviluppo

```bash
npm install
npm run dev      # custom server + Socket.io su http://localhost:3000
npm test         # Vitest: motore di gioco, server socket (integrazione), API helpers
npm run lint
npm run build
```

Variabili d'ambiente (`.env.local` in sviluppo; in produzione le fornisce la piattaforma):

| Variabile | Uso |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | JSON del service account Firebase. Su Cloud Run non serve: il servizio usa la propria identità (Application Default Credentials) |
| `AUTH_SECRET` (o `NEXTAUTH_SECRET`) | Segreto NextAuth; il server socket lo usa per riconoscere l'host dal cookie di sessione |
| `NEXTAUTH_URL` | URL pubblico (usato per il QR code) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_SECURE` | Email di verifica e reset password |
| `NEXT_PUBLIC_ADSENSE_CLIENT_ID`, `NEXT_PUBLIC_ADSENSE_SLOT_ID` | Opzionali, banner AdSense |

## Deploy su Google Cloud Run

L'app gira su Cloud Run **nello stesso progetto Google del Firebase**: così accede a Firestore con l'identità del servizio, senza chiavi JSON.

### Prerequisiti (una volta)

1. Il progetto Firebase deve essere sul piano **Blaze** (fatturazione attiva: Cloud Run lo richiede).
   Con l'uso di qualche serata al mese si resta nel free tier di Cloud Run e di Firestore.
2. Consigliato: un **budget alert** (es. 1 €) in *Fatturazione → Budget e avvisi*, così ogni costo inatteso arriva per email.
3. Esegui i comandi da **Cloud Shell** (console.cloud.google.com, icona del terminale): ha già `gcloud`, `git` e `bash`.
4. Scegli una region vicina alla location di Firestore (*Firestore → Impostazioni*); con `eur3` va bene `europe-west1`.

### Setup iniziale (una volta)

```bash
git clone <repo> && cd serata-quiz
PROJECT_ID=<id-progetto-firebase> REGION=europe-west1 \
AUTH_SECRET='<segreto attuale, per non disconnettere gli host>' \
scripts/setup-cloud-run.sh
```

Lo script abilita le API e crea:
- il repository delle immagini, con pulizia automatica che tiene le ultime 2;
- un service account con il solo ruolo `roles/datastore.user`;
- il secret `serata-auth-secret` in Secret Manager.

### Deploy

```bash
PROJECT_ID=<id-progetto-firebase> REGION=europe-west1 scripts/deploy-cloud-run.sh
```

### Email (opzionale)

Senza SMTP l'app funziona, ma registrazione e recupero password non possono inviare il codice via email.
Per attivarle, aggiungi `SMTP_PASS='...'` al setup e `SMTP_HOST`, `SMTP_USER` (più `SMTP_FROM`, `SMTP_PORT`, `SMTP_SECURE` se servono) al deploy.
Lo script crea il secret `serata-smtp-pass` e imposta le variabili SMTP solo se le passi.

Lo script costruisce l'immagine con Cloud Build (`cloudbuild.yaml`, `Dockerfile`) e la pubblica su Cloud Run.
Al primo deploy imposta `NEXTAUTH_URL` sull'URL del servizio. Con un dominio personalizzato passa `APP_URL=https://...`.
Gli ID AdSense (`NEXT_PUBLIC_ADSENSE_*`) vanno passati allo script, perché finiscono nel bundle in fase di build.

### Impostazioni del servizio (e perché)

| Impostazione | Motivo |
|---|---|
| `--max-instances=1` | Lo stato delle partite vive nella memoria di **una sola istanza** |
| `--min-instances=0`, `--cpu-throttling` | Si paga solo mentre qualcuno è connesso; tra una serata e l'altra il servizio si spegne. La partita riprende comunque da Firestore |
| `--concurrency=1000` | Ogni telefono connesso è una richiesta aperta (il default è 80) |
| `--timeout=3600` | Le WebSocket durano al massimo 60 minuti, poi i client si riconnettono da soli (il default è 5 minuti) |
| `--cpu-boost`, 1 vCPU, 512 MiB | Avvio a freddo più rapido; il server usa circa 130 MB |

### Da sapere

- **Non fare deploy durante una serata.** Cloud Run lascia le connessioni aperte sulla vecchia revisione e manda le nuove alla nuova: la partita in corso si dividerebbe tra due istanze.
- Il primo accesso dopo un periodo di inattività richiede qualche secondo (avvio a freddo): apri la pagina host un paio di minuti prima della serata.
- **Health check:** `GET /api/health` restituisce `{ ok, uptime, activeGames }`. Non usare `/healthz`: Cloud Run riserva alcuni path che finiscono in "z".
- **Riavvii:** su `SIGTERM` il server avvisa i client, completa le scritture in sospeso e chiude.
  Le partite riprendono dalla schermata risultati, e i giocatori rientrano nella squadra con il token salvato sul telefono.
- Gli indici Firestore richiesti sono quelli già usati dalla dashboard (`games`: `hostId` + `createdAt desc`).
- Log: *Cloud Run → serata-quiz → Log*, oppure `gcloud run services logs read serata-quiz --region=europe-west1`.

## Immagini delle categorie

Le animazioni stanno in `public/categories/*.webp` (WebP animato 224×224, ~150–500 KB l'uno).
Per aggiungerne una partendo da APNG/GIF/MP4 (serve ffmpeg con libwebp):

```bash
scripts/optimize-category-image.sh percorso/animazione.apng
```

Poi va registrata in `src/lib/category-images.ts`; un test verifica che ogni file referenziato esista.
