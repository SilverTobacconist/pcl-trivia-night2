import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { loadTriviaTuesdayRows } from "@/lib/googleSheets";

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

function seasonalFinalQuestions(rows: any[]) {
  let finalBlock = false;
  let fallbackNumber = 0;
  const questions: any[] = [];
  for (const row of rows) {
    if (row.round_name === "cask_strength") finalBlock = true;
    else if (finalBlock && row.round_name) finalBlock = false;
    if (!finalBlock || !row.question_text || !row.answer) continue;
    fallbackNumber += 1;
    const difficulty = String(row.difficulty || "").trim() || "Extra Hard";
    questions.push({
      ...row,
      difficulty,
      // Older tabs may have the three follow-on final rows without IDs.  They
      // are still a contiguous Cask Strength block, so keep them playable.
      question_id: row.question_id || `seasonal-final-${difficulty.toLowerCase().replace(/\s+/g,"-")}-${fallbackNumber}`,
      round_name: "cask_strength",
    });
  }
  return questions;
}

export async function POST(request: Request) {
  try {
    const supabase = getSupabaseAdmin();
    const { gameId } = await request.json();
    if (!gameId) return NextResponse.json({ error: "gameId is required." }, { status: 400 });

    const { data: game } = await supabase.from("rickhouse_games").select("*").eq("id", gameId).single();
    if (!game || game.round_name !== "double_cask" || !["round_intermission", "cask_strength_vote"].includes(game.game_phase)) {
      return NextResponse.json({ error: "Double Cask must be complete before Cask Strength begins." }, { status: 400 });
    }

    const { data: scoreRows, error: scoreError } = await supabase.from("rickhouse_scores").select("*").eq("game_id", gameId).order("score", { ascending: true });
    const scores = (scoreRows || []).filter((score:any) => game.trivia_tuesday_event_id ? Number(score.score) >= 0 : Number(score.score) > 0);
    if (scoreError) return NextResponse.json({ error: scoreError.message }, { status: 500 });
    if (!scores?.length) return NextResponse.json({ error: "No players have a positive score, so nobody qualifies." }, { status: 400 });

    const { data: event } = game.trivia_tuesday_event_id ? await supabase.from("trivia_tuesday_events").select("question_sheet_name").eq("id", game.trivia_tuesday_event_id).single() : { data: null };
    let rows: any[];
    if (event) rows = await loadTriviaTuesdayRows(event.question_sheet_name);
    else {
      const response = await fetch(QUESTIONS_CSV_URL, { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load questions from Google Sheets.");
      rows = parseCsv(await response.text());
    }
    if (event) {
      const finals = seasonalFinalQuestions(rows);
      if (!finals.length) return NextResponse.json({ error: "Trivia Tuesday needs at least one completed Cask Strength Final question." }, { status: 400 });
      if (game.game_phase === "round_intermission") return beginVote(supabase, game, scores, finals);
      const { data: votes } = await supabase.from("rickhouse_cask_strength_votes").select("difficulty").eq("game_id", gameId);
      const endsAt = game.cask_strength_vote_ends_at ? new Date(game.cask_strength_vote_ends_at).getTime() : 0;
      if ((votes || []).length < scores.length && Date.now() < endsAt) return NextResponse.json({ waiting: true });
      const counts = new Map<string, number>();
      for (const vote of votes || []) counts.set(vote.difficulty, (counts.get(vote.difficulty) || 0) + 1);
      const chosen = Array.from(counts.entries()).sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0]))[0]?.[0] || "Medium";
      const pool = finals.filter((final) => String(final.difficulty).toLowerCase() === chosen.toLowerCase());
      return beginCask(supabase, game, scores, (pool.length ? pool : finals)[Math.floor(Math.random() * (pool.length ? pool.length : finals.length))], chosen);
    }
    const validRows = rows.filter((q: any) => q.active?.toLowerCase() !== "false" && q.question_id && q.question_text && q.answer);
    const preferred = validRows.filter((q) => ["Hard", "Extra Hard"].includes(q.difficulty));
    const pool = preferred.length ? preferred : validRows;
    const question = pool[Math.floor(Math.random() * pool.length)];
    if (!question) return NextResponse.json({ error: "No eligible Cask Strength question was found." }, { status: 400 });

    return beginCask(supabase, game, scores, question, question.difficulty);
  } catch (error: any) { return NextResponse.json({ error: error.message || "Unknown error." }, { status: 500 }); }
}

async function beginVote(supabase: any, game: any, scores: any[], finals: any[]) {
    await supabase.from("rickhouse_cask_strength_entries").delete().eq("game_id", game.id);
    await supabase.from("rickhouse_cask_strength_votes").delete().eq("game_id", game.id);
    const entries = scores.map((score, index) => ({ game_id: game.id, session_id: game.session_id, player_id: score.player_id, starting_score: Number(score.score), wager: null, submitted_answer: null, is_correct: null, final_score: null, reveal_order: index + 1, is_revealed: false, session_points_awarded: null }));
    const { error } = await supabase.from("rickhouse_cask_strength_entries").insert(entries);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const category = finals[0]?.subcategory || finals[0]?.category || "General";
    const endsAt = new Date(Date.now() + 30000);
    await supabase.from("rickhouse_games").update({ game_phase:"cask_strength_vote", cask_strength_subcategory:category, cask_strength_vote_ends_at:endsAt.toISOString(), cask_strength_ends_at:null }).eq("id",game.id);
    await supabase.from("sessions").update({ question_status:"cask_strength_vote", game_mode:"rickhouse", current_question_text:null, current_subcategory:category, question_ends_at:endsAt.toISOString(), question_duration_seconds:30, show_answer:false }).eq("id",game.session_id);
    return NextResponse.json({ success:true, voting:true });
}

async function beginCask(supabase: any, game: any, scores: any[], question: any, difficulty?: string) {
    const gameId = game.id;
    const entries = scores.map((score, index) => ({
      game_id: gameId, session_id: game.session_id, player_id: score.player_id,
      starting_score: Number(score.score), wager: null, submitted_answer: null,
      is_correct: null, final_score: null, reveal_order: index + 1, is_revealed: false,
      session_points_awarded: null,
    }));
    const { count } = await supabase.from("rickhouse_cask_strength_entries").select("id",{count:"exact",head:true}).eq("game_id",gameId);
    if (!count) { const { error: entryError } = await supabase.from("rickhouse_cask_strength_entries").insert(entries); if (entryError) return NextResponse.json({ error: entryError.message }, { status: 500 }); }

    const startedAt = new Date(); const endsAt = new Date(startedAt.getTime() + 30000);
    const { error: updateError } = await supabase.from("rickhouse_games").update({
      game_phase: "cask_strength_wager",
      cask_strength_question_id: question.question_id,
      cask_strength_question_text: question.question_text,
      cask_strength_correct_answer: question.answer,
      cask_strength_answer_aliases: question.answer_aliases || "",
      cask_strength_subcategory: question.subcategory || question.category || "General",
      cask_strength_difficulty: difficulty || question.difficulty || "Medium",
      cask_strength_vote_ends_at: null,
      cask_strength_started_at: startedAt.toISOString(),
      cask_strength_ends_at: endsAt.toISOString(),
      cask_strength_reveal_index: 0,
    }).eq("id", gameId);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    await supabase.from("sessions").update({ question_status: "cask_strength_wager", game_mode: "rickhouse", current_question_text: null, current_subcategory: question.subcategory || question.category || "General", question_started_at: startedAt.toISOString(), question_ends_at: endsAt.toISOString(), question_duration_seconds: 30, show_answer: false }).eq("id", game.session_id);
    return NextResponse.json({ success: true });
}
