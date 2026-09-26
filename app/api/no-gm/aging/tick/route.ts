import { NextResponse } from "next/server";
import { requireAnonymousPlayer } from "@/lib/noGmAuth";
import { normalizeAnswer } from "@/lib/questions";
import { loadQuestions } from "@/lib/questions";
import { usedQuestionIdsForLocation } from "@/lib/noGmQuestions";

const QUESTION_MS = 60_000; const RESULT_MS = 10_000; const ELIMINATION_MS = 6_000;
const needed = (count: number) => count <= 4 ? 3 : count <= 6 ? 2 : 1;
const points = (place: number) => place === 1 ? 10 : place === 2 ? 8 : place === 3 ? 6 : place === 4 ? 4 : 1;

async function nextQuestion(supabase: any, game: any, session: any, phase: "question" | "bale_question") {
  const used = await usedQuestionIdsForLocation(supabase, session.location, ["main", "last_call", "aging_room"]);
  const pool = (await loadQuestions()).filter((question: any) => question.question_id && question.question_text && question.answer && !used.has(question.question_id));
  if (!pool.length) throw new Error("No unused Aging Room questions are available.");
  const question = pool[Math.floor(Math.random() * pool.length)]; const now = new Date();
  await supabase.from("question_history").insert({ question_id: question.question_id, session_id: session.id, game_mode: "aging_room", date_used: now.toISOString(), question_text: question.question_text, category: question.category, subcategory: question.subcategory, difficulty: question.difficulty, correct_answer: question.answer });
  await supabase.from("aging_room_games").update({ phase, question_number: Number(game.question_number || 0) + 1, attempt_number: 1, question_id: question.question_id, category: question.category, subcategory: question.subcategory, difficulty: question.difficulty, question_text: question.question_text, correct_answer: question.answer, answer_aliases: question.answer_aliases || "", phase_started_at: now.toISOString(), updated_at: now.toISOString() }).eq("id", game.id);
  await supabase.from("sessions").update({ game_mode: "aging_room", question_status: "active", current_question_id: question.question_id, current_question_text: question.question_text, current_category: question.category, current_subcategory: question.subcategory, current_difficulty: question.difficulty, current_answer: question.answer, current_answer_aliases: question.answer_aliases || "", question_started_at: now.toISOString(), question_ends_at: new Date(now.getTime() + QUESTION_MS).toISOString(), question_duration_seconds: 60, show_answer: false }).eq("id", session.id);
}

async function load(supabase: any, sessionId: string, userId: string) {
  const [{ data: session }, { data: control }, { data: player }, { data: game }] = await Promise.all([
    supabase.from("sessions").select("*").eq("id", sessionId).single(), supabase.from("session_controls").select("*").eq("session_id", sessionId).order("updated_at", { ascending: false }).limit(1).maybeSingle(), supabase.from("players").select("id").eq("session_id", sessionId).eq("auth_user_id", userId).single(), supabase.from("aging_room_games").select("*").eq("session_id", sessionId).eq("status", "active").maybeSingle(),
  ]);
  return { session, control, player, game };
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireAnonymousPlayer(request); const { sessionId } = await request.json(); const data = await load(supabase, sessionId, user.id);
    if (!data.session || !data.control || !data.player || !data.game) return NextResponse.json({ ok: true });
    if (data.control.decision_player_id !== data.player.id || data.control.state !== "main_active") return NextResponse.json({ ok: true });
    const { session, game } = data; const now = new Date(); const elapsed = now.getTime() - new Date(game.phase_started_at || game.updated_at).getTime();
    if (data.control.pending_action && ["question_result", "bale_result", "elimination"].includes(game.phase)) {
      await supabase.from("aging_room_games").update({ status: "closed", phase: "ended_early", updated_at: now.toISOString() }).eq("id", game.id);
      if (data.control.pending_action === "end_mode") {
        await supabase.from("sessions").update({ game_mode: "main", question_status: "lobby", current_question_text: null, show_answer: false }).eq("id", sessionId);
        await supabase.from("session_controls").update({ state: "lobby", pending_action: null, updated_at: now.toISOString() }).eq("session_id", sessionId);
      } else {
        await supabase.from("last_call_games").insert({ session_id: sessionId, phase: "voting", phase_started_at: now.toISOString() });
        await supabase.from("sessions").update({ game_mode: "last_call", question_status: "last_call_voting", current_question_text: null, show_answer: false }).eq("id", sessionId);
        await supabase.from("session_controls").update({ pending_action: null, updated_at: now.toISOString() }).eq("session_id", sessionId);
      }
      return NextResponse.json({ ok: true, ended: true });
    }
    const { data: rows } = await supabase.from("aging_room_players").select("*").eq("game_id", game.id);
    const eligible = (rows || []).filter((row: any) => game.phase === "bale_question" ? row.status === "finalist" : row.status === "active");
    const setPhase = async (phase: string, extra: any = {}) => { await supabase.from("aging_room_games").update({ phase, phase_started_at: now.toISOString(), updated_at: now.toISOString(), ...extra }).eq("id", game.id); };
    if (["question", "bale_question"].includes(game.phase)) {
      const { data: answers } = await supabase.from("aging_room_answers").select("*").eq("game_id", game.id).eq("question_number", game.question_number).eq("attempt_number", game.attempt_number).order("submitted_at");
      const allAnswered = eligible.length > 0 && (answers || []).filter((answer: any) => answer.competitive).length >= eligible.length;
      if (!allAnswered && elapsed < QUESTION_MS) return NextResponse.json({ ok: true });
      const accepted = [game.correct_answer, ...String(game.answer_aliases || "").split(/[;,|]/)].filter(Boolean).map(normalizeAnswer);
      const correct = (answers || []).filter((answer: any) => accepted.includes(normalizeAnswer(answer.submitted_answer || "")));
      for (const answer of answers || []) await supabase.from("aging_room_answers").update({ is_correct: correct.some((row: any) => row.id === answer.id) }).eq("id", answer.id);
      const fastest = correct.find((answer: any) => answer.competitive);
      if (!fastest && Number(game.attempt_number) === 1 && allAnswered) {
        await supabase.from("aging_room_games").update({ attempt_number: 2, phase_started_at: now.toISOString(), updated_at: now.toISOString() }).eq("id", game.id);
        await supabase.from("sessions").update({ question_started_at: now.toISOString(), question_ends_at: new Date(now.getTime() + QUESTION_MS).toISOString() }).eq("id", sessionId);
        return NextResponse.json({ ok: true, retry: true });
      }
      if (fastest) {
        const row = eligible.find((item: any) => item.player_id === fastest.player_id);
        if (game.phase === "bale_question") await supabase.from("aging_room_players").update({ bale_count: Number(row?.bale_count || 0) + 1 }).eq("id", row.id);
        else await supabase.from("aging_room_players").update({ round_correct: Number(row?.round_correct || 0) + 1 }).eq("id", row.id);
      }
      await setPhase(game.phase === "bale_question" ? "bale_result" : "question_result");
      await supabase.from("sessions").update({ question_status: "revealed", show_answer: true }).eq("id", sessionId);
      return NextResponse.json({ ok: true });
    }
    if (["question_result", "bale_result"].includes(game.phase) && elapsed >= RESULT_MS) {
      if (game.phase === "bale_result") {
        const { data: refreshed } = await supabase.from("aging_room_players").select("*").eq("game_id", game.id);
        const winner = (refreshed || []).find((row: any) => Number(row.bale_count || 0) >= 5);
        if (winner) {
          const order = [...(refreshed || [])].filter((row: any) => row.status !== "excluded").sort((a: any, b: any) => Number(b.bale_count || 0) - Number(a.bale_count || 0));
          for (let index = 0; index < order.length; index++) { const row = order[index]; const place = index + 1; await supabase.from("aging_room_players").update({ status: place === 1 ? "winner" : "eliminated", final_place: place, session_points_awarded: points(place) }).eq("id", row.id); const { data: p } = await supabase.from("players").select("score").eq("id", row.player_id).single(); await supabase.from("players").update({ score: Number(p?.score || 0) + points(place) }).eq("id", row.player_id); }
          await setPhase("complete", { status: "completed", winner_player_id: winner.player_id }); await supabase.from("sessions").update({ question_status: "aging_room_complete", show_answer: true }).eq("id", sessionId); return NextResponse.json({ ok: true, complete: true });
        }
      }
      const { data: freshRows } = await supabase.from("aging_room_players").select("*").eq("game_id", game.id);
      const active = (freshRows || []).filter((row: any) => row.status === "active"); const passed = (freshRows || []).filter((row: any) => row.status === "passed" || (row.status === "active" && Number(row.round_correct || 0) >= Number(game.required_correct)));
      for (const row of active) if (Number(row.round_correct || 0) >= Number(game.required_correct)) { await supabase.from("aging_room_players").update({ status: "passed" }).eq("id", row.id); }
      const remainingActive = active.filter((row: any) => Number(row.round_correct || 0) < Number(game.required_correct));
      if (remainingActive.length === 1 && passed.length) { await supabase.from("aging_room_players").update({ status: "eliminated", final_place: passed.length + 1 }).eq("id", remainingActive[0].id); await setPhase("elimination", { eliminated_player_id: remainingActive[0].player_id }); return NextResponse.json({ ok: true }); }
      const survivors = (freshRows || []).filter((row: any) => row.status === "passed" || (row.status === "active" && Number(row.round_correct || 0) >= Number(game.required_correct)));
      if (survivors.length === (freshRows || []).filter((row: any) => ["active", "passed"].includes(row.status)).length) { for (const row of survivors) await supabase.from("aging_room_players").update({ status: "active", round_correct: 0 }).eq("id", row.id); await supabase.from("aging_room_games").update({ round_number: Number(game.round_number) + 1, required_correct: needed(survivors.length) }).eq("id", game.id); await nextQuestion(supabase, game, session, "question"); return NextResponse.json({ ok: true }); }
      await nextQuestion(supabase, game, session, "question");
      return NextResponse.json({ ok: true });
    }
    if (game.phase === "elimination" && elapsed >= ELIMINATION_MS) {
      const { data: survivors } = await supabase.from("aging_room_players").select("*").eq("game_id", game.id).eq("status", "passed");
      if ((survivors || []).length === 2) { for (const row of survivors || []) await supabase.from("aging_room_players").update({ status: "finalist", round_correct: 0 }).eq("id", row.id); await supabase.from("aging_room_games").update({ required_correct: 5 }).eq("id", game.id); await nextQuestion(supabase, game, session, "bale_question"); }
      else { for (const row of survivors || []) await supabase.from("aging_room_players").update({ status: "active", round_correct: 0 }).eq("id", row.id); await supabase.from("aging_room_games").update({ round_number: Number(game.round_number) + 1, required_correct: needed((survivors || []).length) }).eq("id", game.id); await nextQuestion(supabase, game, session, "question"); }
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ ok: true });
  } catch (error: any) { return NextResponse.json({ error: error.message || "Could not advance Aging Room." }, { status: 500 }); }
}
