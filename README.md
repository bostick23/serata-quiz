This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Environment Variables

Create a `.env.local` file in the project root with the following variables:

```env
# Firebase
FIREBASE_SERVICE_ACCOUNT=<JSON stringified Firebase service account>

# NextAuth
AUTH_SECRET=<random secret>

# SMTP (required for email verification)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply@example.com
SMTP_PASS=yourpassword
SMTP_FROM="Serata Quiz <noreply@example.com>"
```

> **Note:** The SMTP variables are required for both host account registration (email verification) and the new team email registration flow (see below).

## Team Registration Feature

Players joining a game can choose between two modes:

1. **Guest** – enter a team name and join immediately (existing behaviour, no changes).
2. **Registra squadra** – enter a team name and email address. A 6-digit verification code is sent to the provided email. After entering the correct code the team joins the game.

### API endpoints added

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/team-registration` | Start team registration. Body: `{ teamName, email, joinCode }`. Returns `{ registrationId }`. |
| `POST` | `/api/team-registration/verify` | Verify the 6-digit code. Body: `{ registrationId, code }`. Returns `{ success: true, teamName }`. |

### Firestore collection added

`teamRegistrations` – stores temporary registration documents with fields:
- `teamName`, `email`, `joinCode`
- `code` (6-digit string), `codeExpiresAt` (30 min TTL)
- `verified` (boolean)
- `createdAt`

A resend cooldown of **2 minutes** is enforced per email+joinCode pair to prevent spam.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
