import { loadTriviaTuesdayRows } from "@/lib/googleSheets";

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
  return loadTriviaTuesdayRows("Questions");
}

export function normalizeAnswer(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ");
}
