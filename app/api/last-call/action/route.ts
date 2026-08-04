import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { loadQuestions } from "@/lib/questions";
import { recordGameResult } from "@/lib/gameResults";

const labels = ["", "Easy", "Medium", "Hard", "Extra Hard"];
function placementPoints(place: number) { return place === 1 ? 10 : place === 2 ? 8 : place === 3 ? 6 : place === 4 ? 4 : 1; }
async function gameBySession(sessionId: string) { return (await supabase.from("last_call_games").select("*").eq("session_id", sessionId).single()).data; }

async function awardInterruptedRickhouse(sessionId: string) {
  const { data: game } = await supabase.from("rickhouse_games").select("*").eq("session_id", sessionId).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!game) return;
  const { data: allScores } = await supabase.from("rickhouse_scores").select("*").eq("game_id", game.id).order("score", { ascending: false });
  const scores = (allScores || []).filter((row) => Number(row.score) > 0);
  const scorePlayerIds = (allScores || []).map((row) => row.player_id);
  const { data: scorePlayers } = await supabase.from("players").select("id,display_name").in("id", scorePlayerIds.length ? scorePlayerIds : ["00000000-0000-0000-0000-000000000000"]);
  let index = 0;
  while (index < scores.length) {
    const tied = scores.filter((row) => Number(row.score) === Number(scores[index].score));
    const pool = tied.reduce((sum, _row, offset) => sum + placementPoints(index + offset + 1), 0);
    const award = Math.ceil((pool / tied.length) / 2);
    for (const row of tied) {
      const { data: player } = await supabase.from("players").select("score").eq("id", row.player_id).single();
      if (player) await supabase.from("players").update({ score: Number(player.score || 0) + award }).eq("id", row.player_id);
    }
    index += tied.length;
  }
  await recordGameResult(sessionId, game.id, "rickhouse", (allScores || []).map((row, rowIndex, all) => ({
    player_id: row.player_id,
    player_name: scorePlayers?.find((player) => player.id === row.player_id)?.display_name || "Unknown",
    place: all.findIndex((candidate) => Number(candidate.score) === Number(row.score)) + 1,
    game_score: Number(row.score || 0),
  })));
  await supabase.from("rickhouse_games").update({ status: "completed", game_phase: "interrupted_by_last_call" }).eq("id", game.id);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, sessionId, playerId } = body;
    if (!action || !sessionId) return NextResponse.json({ error: "action and sessionId are required." }, { status: 400 });

    if (action === "start") {
      const existing = await gameBySession(sessionId);
      if (existing) return NextResponse.json({ game: existing });
      const { data: game, error } = await supabase.from("last_call_games").insert({ session_id: sessionId, phase: "voting" }).select("*").single();
      if (error) {
        const concurrentGame = await gameBySession(sessionId);
        if (concurrentGame) return NextResponse.json({ game: concurrentGame });
        throw error;
      }
      await awardInterruptedRickhouse(sessionId);
      await supabase.from("sessions").update({ game_mode: "last_call", question_status: "last_call_voting", current_question_id: null, current_question_text: null, show_answer: false }).eq("id", sessionId);
      return NextResponse.json({ game });
    }

    const game = await gameBySession(sessionId);
    if (!game) return NextResponse.json({ error: "Last Call has not started." }, { status: 404 });

    if (action === "vote") {
      const vote = Number(body.vote);
      if (!playerId || ![1, 2, 3, 4].includes(vote) || game.phase !== "voting") return NextResponse.json({ error: "That vote is not valid now." }, { status: 400 });
      const { error } = await supabase.from("last_call_entries").upsert({ game_id: game.id, session_id: sessionId, player_id: playerId, difficulty_vote: vote }, { onConflict: "game_id,player_id" });
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (action === "finalize_vote") {
      if (game.phase !== "voting") return NextResponse.json({ error: "Voting is already closed." }, { status: 400 });
      const { data: entries } = await supabase.from("last_call_entries").select("*").eq("game_id", game.id).not("difficulty_vote", "is", null);
      if (!entries?.length) return NextResponse.json({ error: "At least one player must vote." }, { status: 400 });
      const counts = [0, 0, 0, 0, 0]; entries.forEach((entry) => counts[Number(entry.difficulty_vote)]++);
      const high = Math.max(...counts); const leaders = [1, 2, 3, 4].filter((value) => counts[value] === high);
      const selected = leaders.length === 1 ? leaders[0] : Math.round(entries.reduce((sum, entry) => sum + Number(entry.difficulty_vote), 0) / entries.length);
      const used = (await supabase.from("question_history").select("question_id").eq("session_id", sessionId)).data?.map((row) => row.question_id) || [];
      const questions = await loadQuestions();
      const pool = questions.filter((question: any) => question.question_id && question.question_text && question.answer && String(question.difficulty).toLowerCase() === labels[selected].toLowerCase() && !used.includes(question.question_id));
      if (!pool.length) return NextResponse.json({ error: `No unused ${labels[selected]} question is available.` }, { status: 400 });
      const question: any = pool[Math.floor(Math.random() * pool.length)];
      for (const entry of entries) {
        const { data: player } = await supabase.from("players").select("score").eq("id", entry.player_id).single();
        await supabase.from("last_call_entries").update({ starting_score: Number(player?.score || 0), wager: null, submitted_answer: null, is_revealed: false }).eq("id", entry.id);
      }
      await supabase.from("question_history").insert({ question_id: question.question_id, session_id: sessionId, game_mode: "last_call", date_used: new Date().toISOString(), question_text: question.question_text, category: question.category, subcategory: question.subcategory, difficulty: question.difficulty, correct_answer: question.answer });
      const { data: updated } = await supabase.from("last_call_games").update({ phase: "wagering", selected_difficulty: labels[selected], category: question.category, subcategory: question.subcategory, question_id: question.question_id, question_text: question.question_text, correct_answer: question.answer, answer_aliases: question.answer_aliases || "" }).eq("id", game.id).select("*").single();
      await supabase.from("sessions").update({ question_status: "last_call_wagering", current_category: question.category, current_subcategory: question.subcategory, current_difficulty: question.difficulty, current_question_id: question.question_id, current_question_text: null, current_answer: question.answer, current_answer_aliases: question.answer_aliases || "", show_answer: false }).eq("id", sessionId);
      return NextResponse.json({ game: updated });
    }

    if (action === "wager") {
      const { data: entry } = await supabase.from("last_call_entries").select("*").eq("game_id", game.id).eq("player_id", playerId).single();
      const wager = Number(body.wager);
      if (game.phase !== "wagering" || !entry || !Number.isInteger(wager) || wager < 0 || wager > Number(entry.starting_score)) return NextResponse.json({ error: "Wager must be a whole number from zero through your maximum." }, { status: 400 });
      await supabase.from("last_call_entries").update({ wager }).eq("id", entry.id);
      return NextResponse.json({ success: true });
    }

    if (action === "show_question") {
      if (game.phase !== "wagering") return NextResponse.json({ error: "The question cannot be shown now." }, { status: 400 });
      await supabase.from("last_call_entries").update({ wager: 0 }).eq("game_id", game.id).is("wager", null);
      await supabase.from("last_call_games").update({ phase: "question" }).eq("id", game.id);
      await supabase.from("sessions").update({ question_status: "last_call_question", current_question_text: game.question_text }).eq("id", sessionId);
      return NextResponse.json({ success: true });
    }

    if (action === "answer") {
      const { data: entry } = await supabase.from("last_call_entries").select("id").eq("game_id", game.id).eq("player_id", playerId).single();
      if (game.phase !== "question" || !entry) return NextResponse.json({ error: "You are not eligible to answer now." }, { status: 400 });
      await supabase.from("last_call_entries").update({ submitted_answer: String(body.answer || "") }).eq("id", entry.id);
      return NextResponse.json({ success: true });
    }

    if (action === "begin_grading") {
      if (game.phase !== "question") return NextResponse.json({ error: "Grading cannot begin now." }, { status: 400 });
      await supabase.from("last_call_entries").update({ submitted_answer: "" }).eq("game_id", game.id).is("submitted_answer", null);
      await supabase.from("last_call_games").update({ phase: "grading" }).eq("id", game.id);
      await supabase.from("sessions").update({ question_status: "last_call_grading" }).eq("id", sessionId);
      return NextResponse.json({ success: true });
    }

    if (action === "grade") {
      const correctIds: string[] = body.correctEntryIds || [];
      const { data: entries } = await supabase.from("last_call_entries").select("*").eq("game_id", game.id);
      if (game.phase !== "grading") return NextResponse.json({ error: "Answers cannot be graded now." }, { status: 400 });
      const calculated = (entries || []).map((entry) => ({ ...entry, is_correct: correctIds.includes(entry.id), final_score: Number(entry.starting_score) + (correctIds.includes(entry.id) ? Number(entry.wager || 0) : -Number(entry.wager || 0)) })).sort((a, b) => Number(a.starting_score) - Number(b.starting_score) || String(a.player_id).localeCompare(String(b.player_id)));
      for (let index = 0; index < calculated.length; index++) await supabase.from("last_call_entries").update({ is_correct: calculated[index].is_correct, final_score: calculated[index].final_score, reveal_order: index + 1 }).eq("id", calculated[index].id);
      await supabase.from("last_call_games").update({ phase: "reveal", reveal_index: 0 }).eq("id", game.id);
      await supabase.from("sessions").update({ question_status: "last_call_reveal", show_answer: true }).eq("id", sessionId);
      return NextResponse.json({ success: true });
    }

    if (action === "reveal_next") {
      const { data: entries } = await supabase.from("last_call_entries").select("*").eq("game_id", game.id).order("reveal_order", { ascending: true });
      const next = entries?.find((entry) => !entry.is_revealed);
      if (!next) return NextResponse.json({ success: true, complete: true });
      await supabase.from("last_call_entries").update({ is_revealed: true }).eq("id", next.id);
      await supabase.from("players").update({ score: next.final_score }).eq("id", next.player_id);
      await supabase.from("last_call_games").update({ reveal_index: Number(game.reveal_index || 0) + 1 }).eq("id", game.id);
      return NextResponse.json({ success: true, complete: entries?.filter((entry) => !entry.is_revealed).length === 1 });
    }

    if (action === "finalize") {
      const { data: entries } = await supabase.from("last_call_entries").select("*").eq("game_id", game.id);
      if (entries?.some((entry) => !entry.is_revealed)) return NextResponse.json({ error: "Reveal every finalist first." }, { status: 400 });
      await supabase.from("last_call_games").update({ phase: "complete" }).eq("id", game.id);
      await supabase.from("sessions").update({ question_status: "last_call_complete" }).eq("id", sessionId);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown Last Call action." }, { status: 400 });
  } catch (error: any) { return NextResponse.json({ error: error.message || "Unknown error." }, { status: 500 }); }
}
