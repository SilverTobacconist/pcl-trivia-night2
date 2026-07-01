import { NextResponse } from "next/server";

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

export async function GET() {
  const response = await fetch(QUESTIONS_CSV_URL, {
    cache: "no-store",
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: "Failed to fetch questions" },
      { status: 500 }
    );
  }

  const csv = await response.text();
  const questions = parseCsv(csv).filter(
    (question) => question.active?.toLowerCase() !== "false"
  );

  return NextResponse.json({
    count: questions.length,
    questions,
  });
}