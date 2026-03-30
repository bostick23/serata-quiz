import nodemailer from "nodemailer";
import { randomInt } from "crypto";

function createTransport() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error("SMTP configuration is incomplete. Set SMTP_HOST, SMTP_USER, and SMTP_PASS environment variables.");
  }

  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user, pass },
  });
}

export function generateCode(): string {
  return String(randomInt(100000, 1000000));
}

export async function sendVerificationEmail(to: string, displayName: string, code: string): Promise<void> {
  const transporter = createTransport();
  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
    to,
    subject: "Conferma la tua email – Serata Quiz",
    text: `Ciao ${displayName},\n\nIl tuo codice di verifica è: ${code}\n\nIl codice scade tra 30 minuti.\n\nSe non hai creato un account su Serata Quiz, ignora questa email.\n\nSerata Quiz`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#7c3aed">Serata Quiz</h2>
        <p>Ciao <strong>${displayName}</strong>,</p>
        <p>Ecco il tuo codice di verifica email:</p>
        <div style="font-size:2rem;font-weight:bold;letter-spacing:.3rem;text-align:center;padding:16px;background:#f3f4f6;border-radius:8px;margin:16px 0">
          ${code}
        </div>
        <p>Il codice scade tra <strong>30 minuti</strong>.</p>
        <p style="color:#6b7280;font-size:.875rem">Se non hai creato un account su Serata Quiz, ignora questa email.</p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(to: string, code: string): Promise<void> {
  const transporter = createTransport();
  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
    to,
    subject: "Recupero password – Serata Quiz",
    text: `Hai richiesto il recupero della password per Serata Quiz.\n\nIl tuo codice è: ${code}\n\nIl codice scade tra 30 minuti.\n\nSe non hai richiesto il recupero, ignora questa email.\n\nSerata Quiz`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#7c3aed">Serata Quiz</h2>
        <p>Hai richiesto il recupero della password.</p>
        <p>Ecco il tuo codice:</p>
        <div style="font-size:2rem;font-weight:bold;letter-spacing:.3rem;text-align:center;padding:16px;background:#f3f4f6;border-radius:8px;margin:16px 0">
          ${code}
        </div>
        <p>Il codice scade tra <strong>30 minuti</strong>.</p>
        <p style="color:#6b7280;font-size:.875rem">Se non hai richiesto il recupero, ignora questa email.</p>
      </div>
    `,
  });
}
