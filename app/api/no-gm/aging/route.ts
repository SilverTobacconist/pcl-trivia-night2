import { NextResponse } from "next/server";
import { requireAnonymousPlayer } from "@/lib/noGmAuth";
import { loadQuestions } from "@/lib/questions";
import { usedQuestionIdsForLocation } from "@/lib/noGmQuestions";

async function questionFor(supabase: any, session: any) {
  const used = await usedQuestionIdsForLocation(supabase, session.location, ["main", "last_call", "aging_room"]);
  const options = (await loadQuestions()).filter((question: any) => question.question_id && question.question_text && question.answer && !used.has(question.question_id));
  if (!options.length) throw new Error("No unused Aging Room questions are available.");
  return options[Math.floor(Math.random() * options.length)];
}

async function setQuestion(supabase: any, game: any, session: any, phase: "question" | "bale_question") {
  const question = await questionFor(supabase, session); const now = new Date(); const endsAt = new Date(now.getTime() + 60_000);
  const number = Number(game.question_number || 0) + 1;
  await supabase.from("question_history").insert({ question_id: question.question_id, session_id: session.id, game_mode: "aging_room", date_used: now.toISOString(), question_text: question.question_text, category: question.category, subcategory: question.subcategory, difficulty: question.difficulty, correct_answer: question.answer });
  await supabase.from("aging_room_games").update({ phase, question_number: number, attempt_number: 1, question_id: question.question_id, category: question.category, subcategory: question.subcategory, difficulty: question.difficulty, question_text: question.question_text, correct_answer: question.answer, answer_aliases: question.answer_aliases || "", phase_started_at: now.toISOString(), updated_at: now.toISOString() }).eq("id", game.id);
  await supabase.from("sessions").update({ game_mode: "aging_room", question_status: "active", current_question_id: question.question_id, current_question_text: question.question_text, current_category: question.category, current_subcategory: question.subcategory, current_difficulty: question.difficulty, current_answer: question.answer, current_answer_aliases: question.answer_aliases || "", question_started_at: now.toISOString(), question_ends_at: endsAt.toISOString(), question_duration_seconds: 60, show_answer: false }).eq("id", session.id);
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireAnonymousPlayer(request); const { sessionId, action, answer } = await request.json();
    const [{ data: player }, { data: control }, { data: session }, { data: game }] = await Promise.all([
      supabase.from("players").select("id,left_at").eq("session_id", sessionId).eq("auth_user_id", user.id).single(),
      supabase.from("session_controls").select("*").eq("session_id", sessionId).single(),
      supabase.from("sessions").select("*").eq("id", sessionId).single(),
      supabase.from("aging_room_games").select("*").eq("session_id", sessionId).in("status", ["active", "setup"]).maybeSingle(),
    ]);
    if (!player || player.left_at || !control || !session) return NextResponse.json({ error: "Game player not found." }, { status: 404 });
    if (action === "start") {
      if (control.decision_player_id !== player.id) return NextResponse.json({ error: "Only the Decision Player starts a mode." }, { status: 403 });
      let activeGame = game;
      if (!activeGame) {
        const created = await supabase.from("aging_room_games").insert({ session_id: sessionId, phase: "setup", status: "active", phase_started_at: new Date().toISOString() }).select("*").single();
        if (created.error) throw created.error; activeGame = created.data;
        const { data: players } = await supabase.from("players").select("id,display_name").eq("session_id", sessionId).is("left_at", null);
        await supabase.from("aging_room_players").insert((players || []).map((row: any) => ({ game_id: activeGame.id, player_id: row.id, player_name: row.display_name, status: "active", round_correct: 0, bale_count: 0 })));
        await supabase.from("aging_room_games").update({ round_number: 1, required_correct: (players || []).length <= 4 ? 3 : (players || []).length <= 6 ? 2 : 1 }).eq("id", activeGame.id);
        activeGame = { ...activeGame, round_number: 1, required_correct: (players || []).length <= 4 ? 3 : (players || []).length <= 6 ? 2 : 1 };
      }
      await setQuestion(supabase, activeGame, session, "question");
      await supabase.from("session_controls").update({ state: "main_active", last_activity_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("session_id", sessionId);
      return NextResponse.json({ ok: true });
    }
    if (!game) return NextResponse.json({ error: "Aging Room is not active." }, { status: 404 });
    if (action === "answer") {
      const value = String(answer || "").trim(); if (!value || !["question", "bale_question"].includes(game.phase)) return NextResponse.json({ error: "Answer entry is closed." }, { status: 400 });
      const { data: agingPlayer } = await supabase.from("aging_room_players").select("id,status").eq("game_id", game.id).eq("player_id", player.id).single();
      if (!agingPlayer || !["active", "finalist"].includes(agingPlayer.status)) return NextResponse.json({ error: "You are not eligible for this question." }, { status: 403 });
      const { error } = await supabase.from("aging_room_answers").insert({ game_id: game.id, player_id: player.id, question_number: game.question_number, attempt_number: game.attempt_number, submitted_answer: value, competitive: true });
      if (error?.code === "23505") return NextResponse.json({ error: "You already answered this attempt." }, { status: 409 });
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Unknown Aging Room action." }, { status: 400 });
  } catch (error: any) { return NextResponse.json({ error: error.message || "Could not update Aging Room." }, { status: 500 }); }
}
