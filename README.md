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
| `FIREBASE_SERVICE_ACCOUNT` | JSON del service account Firebase |
| `AUTH_SECRET` (o `NEXTAUTH_SECRET`) | Segreto NextAuth; il server socket lo usa per riconoscere l'host dal cookie di sessione |
| `NEXTAUTH_URL` | URL pubblico (usato per il QR code) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_SECURE` | Email di verifica e reset password |
| `NEXT_PUBLIC_ADSENSE_CLIENT_ID`, `NEXT_PUBLIC_ADSENSE_SLOT_ID` | Opzionali, banner AdSense |

## Deploy: vincoli importanti

- **Una sola istanza.** Lo stato delle partite vive nella memoria del processo: niente autoscaling né più repliche.
  Per scalare servirebbero l'adapter Redis di Socket.io e lo stato condiviso in Redis.
- **WebSocket abilitati** sulla piattaforma. Su Azure App Service: *Web sockets = On*, *Always On = On*, ARR affinity attiva.
  Se i WebSocket sono bloccati, Socket.io ripiega automaticamente sul long-polling.
- **Health check:** `GET /healthz` restituisce `{ ok, uptime, activeGames }`.
- **Riavvii:** su `SIGTERM`/`SIGINT` il server avvisa i client, completa le scritture in sospeso e chiude.
  Le partite in corso riprendono dalla schermata risultati della domanda corrente, e i giocatori rientrano automaticamente nella propria squadra con il token salvato sul telefono.
- Gli indici Firestore richiesti sono quelli già usati dalla dashboard (`games`: `hostId` + `createdAt desc`).

## Immagini delle categorie

Le animazioni stanno in `public/categories/*.webp` (WebP animato 224×224, ~150–500 KB l'uno).
Per aggiungerne una partendo da APNG/GIF/MP4 (serve ffmpeg con libwebp):

```bash
scripts/optimize-category-image.sh percorso/animazione.apng
```

Poi va registrata in `src/lib/category-images.ts`; un test verifica che ogni file referenziato esista.
