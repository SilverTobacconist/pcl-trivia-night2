import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

const QUESTIONS_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSpLt8hHXfb9tNryhHh6w7Z7GZ-evzFcpZZ512sdYNKKW_dnQ-LDgwI9jGLhJAOPQ/pub?gid=802549699&single=true&output=csv";

function parseCsvLine(line: string) {
  const result: string[] = []; let current = ""; let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i]; const next = line[i + 1];
    if (char === '"' && next === '"') { current += '"'; i++; }
    else if (char === '"') inQuotes = !inQuotes;
    else if (char === "," && !inQuotes) { result.push(current); current = ""; }
    else current += char;
  }
  result.push(current); return result;
}
function parseCsv(csv: string) {
  const lines = csv.trim().split(/\r?\n/); const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => { const values = parseCsvLine(line); const row: Record<string,string> = {}; headers.forEach((h,i)=>row[h]=values[i]??""); return row; });
}

export async function POST(request: Request) {
  try {
    const { gameId } = await request.json();
    if (!gameId) return NextResponse.json({ error: "gameId is required." }, { status: 400 });

    const { data: game } = await supabase.from("rickhouse_games").select("*").eq("id", gameId).single();
    if (!game || game.round_name !== "double_cask" || game.game_phase !== "round_intermission") {
      return NextResponse.json({ error: "Double Cask must be complete before Cask Strength begins." }, { status: 400 });
    }

    const { data: scores, error: scoreError } = await supabase.from("rickhouse_scores").select("*").eq("game_id", gameId).gt("score", 0).order("score", { ascending: true });
    if (scoreError) return NextResponse.json({ error: scoreError.message }, { status: 500 });
    if (!scores?.length) return NextResponse.json({ error: "No players have a positive score, so nobody qualifies." }, { status: 400 });

    const response = await fetch(QUESTIONS_CSV_URL, { cache: "no-store" });
    if (!response.ok) throw new Error("Could not load questions from Google Sheets.");
    const rows = parseCsv(await response.text()).filter((q) => q.active?.toLowerCase() !== "false" && q.question_id && q.question_text && q.answer);
    const preferred = rows.filter((q) => ["Hard", "Extra Hard"].includes(q.difficulty));
    const pool = preferred.length ? preferred : rows;
    const question = pool[Math.floor(Math.random() * pool.length)];
    if (!question) return NextResponse.json({ error: "No eligible Cask Strength question was found." }, { status: 400 });

    await supabase.from("rickhouse_cask_strength_entries").delete().eq("game_id", gameId);
    const entries = scores.map((score, index) => ({
      game_id: gameId, session_id: game.session_id, player_id: score.player_id,
      starting_score: Number(score.score), wager: null, submitted_answer: null,
      is_correct: null, final_score: null, reveal_order: index + 1, is_revealed: false,
      session_points_awarded: null,
    }));
    const { error: entryError } = await supabase.from("rickhouse_cask_strength_entries").insert(entries);
    if (entryError) return NextResponse.json({ error: entryError.message }, { status: 500 });

    const startedAt = new Date(); const endsAt = new Date(startedAt.getTime() + 30000);
    const { error: updateError } = await supabase.from("rickhouse_games").update({
      game_phase: "cask_strength_wager",
      cask_strength_question_id: question.question_id,
      cask_strength_question_text: question.question_text,
      cask_strength_correct_answer: question.answer,
      cask_strength_answer_aliases: question.answer_aliases || "",
      cask_strength_subcategory: question.subcategory || question.category || "General",
      cask_strength_started_at: startedAt.toISOString(),
      cask_strength_ends_at: endsAt.toISOString(),
      cask_strength_reveal_index: 0,
    }).eq("id", gameId);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    await supabase.from("sessions").update({ question_status: "cask_strength_wager", game_mode: "rickhouse", current_question_text: null, current_subcategory: question.subcategory || question.category || "General", question_started_at: startedAt.toISOString(), question_ends_at: endsAt.toISOString(), question_duration_seconds: 30, show_answer: false }).eq("id", game.session_id);
    return NextResponse.json({ success: true });
  } catch (error: any) { return NextResponse.json({ error: error.message || "Unknown error." }, { status: 500 }); }
}