import { NextResponse } from "next/server";
import { questionsCol } from "@/lib/firebase/collections";
import { auth } from "@/lib/auth/config";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const language = searchParams.get("language") ?? "it";

    // Two queries: public + user's own, filtered by language
    const [publicSnap, userSnap] = await Promise.all([
      questionsCol()
        .where("ownerId", "==", null)
        .where("language", "==", language)
        .get(),
      questionsCol()
        .where("ownerId", "==", session.user.id)
        .where("language", "==", language)
        .get(),
    ]);

    const categorySet = new Set<string>();
    for (const doc of [...publicSnap.docs, ...userSnap.docs]) {
      const cat = doc.data().category;
      if (cat) categorySet.add(cat);
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
