import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

const QUESTIONS_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSpLt8hHXfb9tNryhHh6w7Z7GZ-evzFcpZZ512sdYNKKW_dnQ-LDgwI9jGLhJAOPQ/pub?gid=802549699&single=true&output=csv";

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
    const row: Record<string, string> = {};

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

  return parseCsv(csv).filter(
    (question) => question.active?.toLowerCase() !== "false"
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionId, location } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId is required." },
        { status: 400 }
      );
    }

    const questions = await getQuestions();

    const eligibleQuestions = questions.filter((question: any) => {
      if (!question.question_id) return false;
      if (!question.question_text) return false;

      if (location === "Hastings") {
        return question.hastings_used?.toLowerCase() !== "true";
      }

      if (location === "Norfolk") {
        return question.norfolk_used?.toLowerCase() !== "true";
      }

      return true;
    });

    if (eligibleQuestions.length === 0) {
      return NextResponse.json(
        { error: "No eligible questions found." },
        { status: 404 }
      );
    }

    const randomIndex = Math.floor(Math.random() * eligibleQuestions.length);
    const question = eligibleQuestions[randomIndex];

    const { error: historyError } = await supabase
      .from("question_history")
      .insert({
        question_id: question.question_id,
        session_id: sessionId,
        game_mode: "main",
        date_used: new Date().toISOString(),
      });

    if (historyError) {
      return NextResponse.json(
        {
          error: "Question displayed, but history was not saved.",
          details: historyError.message,
          code: historyError.code,
          hint: historyError.hint,
        },
        { status: 500 }
      );
    }

    const startedAt = new Date();
    const durationSeconds = 60;
    const endsAt = new Date(startedAt.getTime() + durationSeconds * 1000);

    const { error: sessionUpdateError } = await supabase
      .from("sessions")
      .update({
        current_question_id: question.question_id,
        current_question_text: question.question_text,
        current_category: question.category,
        current_subcategory: question.subcategory,
        current_difficulty: question.difficulty,
        current_answer: question.answer,
        current_answer_aliases: question.answer_aliases,
        question_started_at: startedAt.toISOString(),
        question_ends_at: endsAt.toISOString(),
        question_duration_seconds: durationSeconds,
        question_status: "active",
        show_answer: false,
      })
      .eq("id", sessionId);

    if (sessionUpdateError) {
      return NextResponse.json(
        {
          error: "Question selected but session was not updated.",
          details: sessionUpdateError.message,
          code: sessionUpdateError.code,
          hint: sessionUpdateError.hint,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ question });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}