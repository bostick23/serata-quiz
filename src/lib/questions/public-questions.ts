import { questionsCol, type QuestionDoc } from "@/lib/firebase/collections";
import { createTtlCache } from "./ttl-cache";

export type BankQuestion = { id: string } & QuestionDoc;

/**
 * The public question bank (~1000+ docs, seeded, rarely edited) was read in full
 * from Firestore on every game creation and every category lookup. It is now
 * cached in memory per language and invalidated when a public question changes.
 */
const TTL_MS = 10 * 60 * 1000;

type PublicCache = ReturnType<typeof createTtlCache<string, BankQuestion[]>>;

// Stored on globalThis so every route bundle in the process shares one cache.
const globalStore = globalThis as typeof globalThis & { __serataPublicQuestions?: PublicCache };

function cache(): PublicCache {
  globalStore.__serataPublicQuestions ??= createTtlCache(async (language: string) => {
    const snap = await questionsCol().where("ownerId", "==", null).where("language", "==", language).get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }, TTL_MS);
  return globalStore.__serataPublicQuestions;
}

/** Cached public questions of a language. The returned array is shared: do not mutate it. */
export function getPublicQuestions(language: string): Promise<BankQuestion[]> {
  return cache().get(language);
}

export function invalidatePublicQuestions(): void {
  cache().invalidate();
}

export async function getUserQuestions(userId: string, language?: string): Promise<BankQuestion[]> {
  let query = questionsCol().where("ownerId", "==", userId);
  if (language) query = query.where("language", "==", language);
  const snap = await query.get();
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
