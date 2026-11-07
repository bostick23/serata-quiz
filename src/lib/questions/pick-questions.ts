export interface PickOptions {
  numQuestions: number;
  maxPerCategory: number;
  categories?: string[];
  excludeIds?: Set<string>;
}

export type PickResult<T> =
  | { ok: true; questions: T[] }
  | { ok: false; reason: "not-enough"; available: number }
  | { ok: false; reason: "category-limit"; selectable: number };

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Random selection with an optional category filter, exclusions and a per-category cap. */
export function pickQuestions<T extends { id: string; category: string | null }>(
  bank: T[],
  options: PickOptions,
  shuffleFn: (arr: T[]) => T[] = shuffle,
): PickResult<T> {
  const { numQuestions, maxPerCategory, categories, excludeIds } = options;

  let available = bank;
  if (categories && categories.length > 0) {
    const wanted = new Set(categories);
    available = available.filter(q => q.category !== null && wanted.has(q.category));
  }
  if (excludeIds && excludeIds.size > 0) {
    available = available.filter(q => !excludeIds.has(q.id));
  }
  if (available.length < numQuestions) return { ok: false, reason: "not-enough", available: available.length };

  const perCategory = new Map<string, number>();
  const picked: T[] = [];
  for (const q of shuffleFn(available)) {
    const cat = q.category ?? "unknown";
    const count = perCategory.get(cat) ?? 0;
    if (count >= maxPerCategory) continue;
    perCategory.set(cat, count + 1);
    picked.push(q);
    if (picked.length >= numQuestions) break;
  }
  if (picked.length < numQuestions) return { ok: false, reason: "category-limit", selectable: picked.length };

  return { ok: true, questions: picked };
}
