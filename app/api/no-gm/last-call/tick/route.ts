import { NextResponse } from "next/server";
import { requireAnonymousPlayer } from "@/lib/noGmAuth";
import { loadQuestions, normalizeAnswer } from "@/lib/questions";
import { usedQuestionIdsForLocation } from "@/lib/noGmQuestions";

const VOTE_SECONDS = 45;
const WAGER_SECONDS = 45;
const QUESTION_SECONDS = 60;
const REVEAL_SECONDS = 3;
const COMPLETE_SECONDS = 10;

async function exportLeaderboard(supabase: any, sessionId: string) {
  const { data: leaderboard } = await supabase.from("players").select("id,display_name,score").eq("session_id", sessionId).order("score", { ascending: false });
  const { error } = await supabase.from("session_leaderboard_exports").upsert({ session_id: sessionId, reason: "completed", leaderboard: leaderboard || [] }, { onConflict: "session_id" });
  if (error) throw error;
}

function difficultyLabel(value: number) {
  return ["", "Easy", "Medium", "Hard", "Extra Hard"][value] || "Medium";
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireAnonymousPlayer(request);
    const { sessionId } = await request.json();
    const [{ data: session }, { data: control }, { data: player }, { data: game }] = await Promise.all([
      supabase.from("sessions").select("*").eq("id", sessionId).single(),
      supabase.from("session_controls").select("*").eq("session_id", sessionId).single(),
      supabase.from("players").select("id").eq("session_id", sessionId).eq("auth_user_id", user.id).single(),
      supabase.from("last_call_games").select("*").eq("session_id", sessionId).is("completed_at", null).maybeSingle(),
    ]);
    if (!session || !control || !player || !game) return NextResponse.json({ error: "Last Call was not found." }, { status: 404 });
    if (control.decision_player_id !== player.id || control.state !== "main_active") return NextResponse.json({ ok: true });
    const now = new Date();
    const elapsed = now.getTime() - new Date(game.phase_started_at || game.created_at).getTime();
    const { data: entries } = await supabase.from("last_call_entries").select("*").eq("game_id", game.id);
    const phaseUpdate = async (phase: string, extra: Record<string, any> = {}) => {
      const { error } = await supabase.from("last_call_games").update({ phase, phase_started_at: now.toISOString(), ...extra }).eq("id", game.id);
      if (error) throw error;
    };

    if (game.phase === "voting") {
      const { count: playerCount } = await supabase.from("players").select("id", { count: "exact", head: true }).eq("session_id", sessionId);
      if ((entries || []).length < (playerCount || 0) && elapsed < VOTE_SECONDS * 1000) return NextResponse.json({ ok: true });
      let participants = entries || [];
      if (!participants.length) {
        const { data: allPlayers } = await supabase.from("players").select("id").eq("session_id", sessionId);
        const fallback = (allPlayers || []).map((p: any) => ({ game_id: game.id, session_id: sessionId, player_id: p.id, difficulty_vote: 2 }));
        if (fallback.length) { const { error } = await supabase.from("last_call_entries").insert(fallback); if (error) throw error; }
        participants = fallback;
      }
      const totals = [0, 0, 0, 0, 0]; participants.forEach((entry: any) => { totals[Number(entry.difficulty_vote) || 2]++; });
      const selected = totals.reduce((best, count, index) => count > totals[best] ? index : best, 1);
      const usedIds = await usedQuestionIdsForLocation(supabase, session.location, ["main", "last_call"]);
      const candidates = (await loadQuestions()).filter((question: any) => question.question_id && question.question_text && !usedIds.has(question.question_id) && String(question.difficulty || "").toLowerCase().includes(difficultyLabel(selected).toLowerCase()));
      const pool = candidates.length ? candidates : (await loadQuestions()).filter((question: any) => question.question_id && question.question_text && !usedIds.has(question.question_id));
      if (!pool.length) throw new Error("No unused Last Call questions are available for this location.");
      const question = pool[Math.floor(Math.random() * pool.length)];
      const { error: historyError } = await supabase.from("question_history").insert({ question_id: question.question_id, session_id: sessionId, game_mode: "last_call", date_used: now.toISOString(), question_text: question.question_text, category: question.category, subcategory: question.subcategory, difficulty: question.difficulty, correct_answer: question.answer });
      if (historyError) throw historyError;
      for (const entry of participants) {
        const { data: participant } = await supabase.from("players").select("score").eq("id", entry.player_id).single();
        await supabase.from("last_call_entries").update({ starting_score: Number(participant?.score || 0) }).eq("game_id", game.id).eq("player_id", entry.player_id);
      }
      await phaseUpdate("wagering", { selected_difficulty: difficultyLabel(selected), category: question.category, subcategory: question.subcategory, question_id: question.question_id, question_text: question.question_text, correct_answer: question.answer, answer_aliases: question.answer_aliases });
      await supabase.from("sessions").update({ question_status: "last_call_wagering", current_question_id: question.question_id, current_category: question.category, current_subcategory: question.subcategory, current_difficulty: question.difficulty, current_question_text: null, current_answer: question.answer, current_answer_aliases: question.answer_aliases, show_answer: false }).eq("id", sessionId);
      return NextResponse.json({ ok: true, phase: "wagering" });
    }
    if (game.phase === "wagering") {
      const allWagered = (entries || []).every((entry: any) => entry.wager !== null && entry.wager !== undefined);
      if (!allWagered && elapsed < WAGER_SECONDS * 1000) return NextResponse.json({ ok: true });
      if (!allWagered) await supabase.from("last_call_entries").update({ wager: 0 }).eq("game_id", game.id).is("wager", null);
      await phaseUpdate("question");
      await supabase.from("sessions").update({ question_status: "active", current_question_text: game.question_text, question_started_at: now.toISOString(), question_ends_at: new Date(now.getTime() + QUESTION_SECONDS * 1000).toISOString(), question_duration_seconds: QUESTION_SECONDS, show_answer: false }).eq("id", sessionId);
      return NextResponse.json({ ok: true, phase: "question" });
    }
    if (game.phase === "question") {
      const allAnswered = (entries || []).every((entry: any) => entry.submitted_answer !== null && entry.submitted_answer !== undefined);
      if (!allAnswered && elapsed < QUESTION_SECONDS * 1000) return NextResponse.json({ ok: true });
      const accepted = [game.correct_answer, ...String(game.answer_aliases || "").split(/[;,]/)].filter(Boolean).map(normalizeAnswer);
      for (const entry of entries || []) {
        const correct = accepted.includes(normalizeAnswer(entry.submitted_answer || ""));
        const finalScore = Number(entry.starting_score || 0) + (correct ? Number(entry.wager || 0) : -Number(entry.wager || 0));
        await supabase.from("last_call_entries").update({ is_correct: correct, final_score: finalScore, is_revealed: false }).eq("id", entry.id);
      }
      await phaseUpdate("reveal", { reveal_index: 0 });
      await supabase.from("sessions").update({ question_status: "revealed", show_answer: true }).eq("id", sessionId);
      return NextResponse.json({ ok: true, phase: "reveal" });
    }
    if (game.phase === "reveal") {
      const sorted = [...(entries || [])].sort((a: any, b: any) => Number(a.starting_score || 0) - Number(b.starting_score || 0));
      if (elapsed < REVEAL_SECONDS * 1000) return NextResponse.json({ ok: true });
      const entry = sorted[Number(game.reveal_index || 0)];
      if (entry) {
        await supabase.from("last_call_entries").update({ is_revealed: true }).eq("id", entry.id);
        await supabase.from("players").update({ score: Number(entry.final_score || 0) }).eq("id", entry.player_id);
        await phaseUpdate("reveal", { reveal_index: Number(game.reveal_index || 0) + 1 });
        return NextResponse.json({ ok: true, revealed: true });
      }
      await phaseUpdate("complete");
      return NextResponse.json({ ok: true, phase: "complete" });
    }
    if (game.phase === "complete" && elapsed >= COMPLETE_SECONDS * 1000) {
      await exportLeaderboard(supabase, sessionId);
      await supabase.from("last_call_games").update({ completed_at: now.toISOString() }).eq("id", game.id);
      await supabase.from("session_controls").update({ state: "ended", ended_at: now.toISOString(), exported_at: now.toISOString(), updated_at: now.toISOString() }).eq("session_id", sessionId);
      await supabase.from("sessions").update({ status: "ended", game_mode: "complete", question_status: "closed", show_answer: true }).eq("id", sessionId);
    }
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Could not advance Last Call." }, { status: 500 });
  }
}
