import { config } from "dotenv";
config({ path: ".env.local" });

import { Timestamp } from "firebase-admin/firestore";
import { questionsCol } from "../firebase/collections";
import { decode } from "html-entities";

const CATEGORIES_URL = "https://opentdb.com/api_category.php";
const API_URL = "https://opentdb.com/api.php";
const DIFFICULTIES = ["easy", "medium", "hard"] as const;
const QUESTIONS_PER_REQUEST = 50;

// Rate limit: OpenTDB allows 1 request per 5 seconds
function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface OpenTDBQuestion {
  category: string;
  type: string;
  difficulty: string;
  question: string;
  correct_answer: string;
  incorrect_answers: string[];
}

interface OpenTDBResponse {
  response_code: number;
  results: OpenTDBQuestion[];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function fetchQuestions(categoryId: number, difficulty: string): Promise<OpenTDBQuestion[]> {
  const url = `${API_URL}?amount=${QUESTIONS_PER_REQUEST}&category=${categoryId}&difficulty=${difficulty}&type=multiple`;
  try {
    const res = await fetch(url);
    const data: OpenTDBResponse = await res.json();
    if (data.response_code === 0) {
      return data.results;
    }
    if (data.response_code === 1) {
      // Not enough questions for this category/difficulty
      console.log(`  No results for category ${categoryId} ${difficulty} (not enough questions)`);
      return [];
    }
    console.log(`  API response code ${data.response_code} for category ${categoryId} ${difficulty}`);
    return [];
  } catch (err) {
    console.error(`  Fetch error for category ${categoryId} ${difficulty}:`, err);
    return [];
  }
}

async function seed() {
  console.log("Fetching categories from OpenTDB...");
  const catRes = await fetch(CATEGORIES_URL);
  const catData = await catRes.json();
  const categories: { id: number; name: string }[] = catData.trivia_categories;
  console.log(`Found ${categories.length} categories\n`);

  let totalInserted = 0;
  let totalSkipped = 0;

  for (const cat of categories) {
    console.log(`Category: ${cat.name} (ID: ${cat.id})`);

    for (const difficulty of DIFFICULTIES) {
      // Wait 5.5 seconds between requests to respect rate limit
      await sleep(5500);

      const rawQuestions = await fetchQuestions(cat.id, difficulty);
      let catInserted = 0;

      for (const q of rawQuestions) {
        // Decode HTML entities
        const text = decode(q.question);
        const correctAnswer = decode(q.correct_answer);
        const incorrectAnswers = q.incorrect_answers.map(a => decode(a));

        // Check for duplicate
        const existingSnap = await questionsCol()
          .where("text", "==", text)
          .where("language", "==", "en")
          .limit(1)
          .get();

        if (!existingSnap.empty) {
          totalSkipped++;
          continue;
        }

        // Shuffle choices and find correct index
        const allChoices = shuffle([correctAnswer, ...incorrectAnswers]);
        const correctIndex = allChoices.indexOf(correctAnswer);

        await questionsCol().doc().set({
          ownerId: null,
          category: q.category,
          language: "en",
          text,
          choices: allChoices,
          correctIndex,
          createdAt: Timestamp.now(),
        });

        catInserted++;
        totalInserted++;
      }

      if (rawQuestions.length > 0) {
        console.log(`  ${difficulty}: ${catInserted} inserted, ${rawQuestions.length - catInserted} skipped`);
      }
    }
  }

  console.log(`\nDone! Inserted ${totalInserted} English questions, skipped ${totalSkipped} duplicates.`);

  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
