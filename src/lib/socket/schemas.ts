import { z } from "zod";
import { normalizeTeamName } from "./game-engine";

/** ~30 KB of JPEG once base64-encoded; the client sends 128px images of a few KB. */
export const MAX_PHOTO_LENGTH = 40_000;

const joinCode = z
  .string()
  .transform(s => s.trim().toUpperCase())
  .pipe(z.string().regex(/^[A-Z0-9]{4,12}$/));

export const joinCodePayloadSchema = z.object({ joinCode });

export const joinPayloadSchema = z.object({
  joinCode,
  teamName: z
    .string()
    .transform(normalizeTeamName)
    .pipe(z.string().min(1).max(50)),
  photoUrl: z
    .string()
    .max(MAX_PHOTO_LENGTH)
    .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/)
    .nullish(),
  rejoinToken: z.string().min(1).max(128).nullish(),
});

export const rejoinPayloadSchema = z.object({
  joinCode,
  teamId: z.string().min(1).max(128),
  rejoinToken: z.string().min(1).max(128),
});

export const answerPayloadSchema = z.object({
  joinCode,
  gameQuestionId: z.string().min(1).max(128),
  chosenIndex: z.number().int().min(0).max(9),
});

export const timeSyncPayloadSchema = z.object({ clientTime: z.number().finite() });
