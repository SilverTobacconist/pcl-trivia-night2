export const QUESTIONS_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSpLt8hHXfb9tNryhHh6w7Z7GZ-evzFcpZZ512sdYNKKW_dnQ-LDgwI9jGLhJAOPQ/pub?gid=802549699&single=true&output=csv";

function parseCsvLine(line: string) {
  const result: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index++) {
    const character = line[index];
    if (character === '"' && line[index + 1] === '"') {
      current += '"';
      index++;
    } else if (character === '"') quoted = !quoted;
    else if (character === "," && !quoted) {
      result.push(current);
      current = "";
    } else current += character;
  }
  result.push(current);
  return result;
}

export async function loadQuestions() {
  const response = await fetch(QUESTIONS_CSV_URL, { cache: "no-store" });
  if (!response.ok) throw new Error("Could not load questions from Google Sheets.");
  const lines = (await response.text()).trim().split(/\r?\n/);
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  }).filter((question: any) => question.active?.toLowerCase() !== "false");
}

export function normalizeAnswer(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ");
}

