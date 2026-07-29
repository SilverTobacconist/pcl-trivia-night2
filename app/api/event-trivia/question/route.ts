import { NextResponse } from "next/server";

const QUESTIONS_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSpLt8hHXfb9tNryhHh6w7Z7GZ-evzFcpZZ512sdYNKKW_dnQ-LDgwI9jGLhJAOPQ/pub?gid=802549699&single=true&output=csv";

type QuestionRow = Record<string, string>;

function parseCsvLine(line: string) {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"' && nextChar === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

function parseCsv(csv: string) {
  const lines = csv.trim().split(/\r?\n/);
  const headers = parseCsvLine(lines[0]);

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row: QuestionRow = {};

    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });

    return row;
  });
}

async function getQuestions() {
  const response = await fetch(QUESTIONS_CSV_URL, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Could not load questions from Google Sheets.");
  }

  const csv = await response.text();

  return parseCsv(csv).filter((question) => {
    if (!question.question_id?.trim()) return false;
    if (!question.question_text?.trim()) return false;
    if (!question.answer?.trim()) return false;

    return question.active?.trim().toLowerCase() !== "false";
  });
}

function randomQuestion(questions: QuestionRow[]) {
  const randomIndex = Math.floor(Math.random() * questions.length);
  return questions[randomIndex];
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const keyword =
      typeof body.keyword === "string" ? body.keyword.trim().toLowerCase() : "";

    const preferKeywordQuestion = body.preferKeywordQuestion === true;

    const usedQuestionIds = new Set(
      Array.isArray(body.usedQuestionIds)
        ? body.usedQuestionIds.filter((value: unknown) => typeof value === "string")
        : []
    );

    const allQuestions = await getQuestions();

    let availableQuestions = allQuestions.filter(
      (question) => !usedQuestionIds.has(question.question_id)
    );

    let questionPoolReset = false;

    if (availableQuestions.length === 0) {
      availableQuestions = allQuestions;
      questionPoolReset = true;
    }

    const matchingQuestions = keyword
      ? availableQuestions.filter((question) => {
          const category = question.category?.toLowerCase() ?? "";
          const subcategory = question.subcategory?.toLowerCase() ?? "";

          return category.includes(keyword) || subcategory.includes(keyword);
        })
      : [];

    const shouldUseKeywordPool =
      preferKeywordQuestion && matchingQuestions.length > 0;

    const selectedPool = shouldUseKeywordPool
      ? matchingQuestions
      : availableQuestions;

    if (selectedPool.length === 0) {
      return NextResponse.json(
        { error: "No active questions are currently available." },
        { status: 404 }
      );
    }

    const question = randomQuestion(selectedPool);

    return NextResponse.json({
      question: {
        question_id: question.question_id,
        category: question.category,
        subcategory: question.subcategory,
        difficulty: question.difficulty,
        question_text: question.question_text,
        answer: question.answer,
        answer_aliases: question.answer_aliases,
      },
      usedKeywordPool: shouldUseKeywordPool,
      keywordMatchesAvailable: matchingQuestions.length > 0,
      questionPoolReset,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
