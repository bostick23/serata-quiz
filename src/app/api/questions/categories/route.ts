import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { getPublicQuestions, getUserQuestions } from "@/lib/questions/public-questions";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const language = searchParams.get("language") === "en" ? "en" : "it";

    // Public bank from the in-memory cache + the user's own questions.
    const [publicQuestions, userQuestions] = await Promise.all([
      getPublicQuestions(language),
      getUserQuestions(session.user.id, language),
    ]);

    const categorySet = new Set<string>();
    for (const q of [...publicQuestions, ...userQuestions]) {
      if (q.category) categorySet.add(q.category);
    }

    const categories = [...categorySet].sort((a, b) => a.localeCompare(b));

    return NextResponse.json(categories);
  } catch (error) {
    console.error("Get categories error:", error);
    return NextResponse.json(
      { error: "Errore durante il recupero delle categorie" },
      { status: 500 }
    );
  }
}
