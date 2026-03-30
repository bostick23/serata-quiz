import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { questions } from "@/lib/db/schema";
import { auth } from "@/lib/auth/config";
import { eq, or, isNull, isNotNull, and } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const language = searchParams.get("language") ?? "it";

    const rows = await db
      .selectDistinct({ category: questions.category })
      .from(questions)
      .where(
        and(
          eq(questions.language, language),
          or(isNull(questions.ownerId), eq(questions.ownerId, session.user.id)),
          isNotNull(questions.category)
        )
      );

    const categories = rows
      .map((r) => r.category as string)
      .sort((a, b) => a.localeCompare(b));

    return NextResponse.json(categories);
  } catch (error) {
    console.error("Get categories error:", error);
    return NextResponse.json(
      { error: "Errore durante il recupero delle categorie" },
      { status: 500 }
    );
  }
}
