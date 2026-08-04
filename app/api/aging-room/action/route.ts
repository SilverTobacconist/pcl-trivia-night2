import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { loadQuestions } from "@/lib/questions";
import { recordGameResult } from "@/lib/gameResults";

function requiredFor(count: number) { return count <= 4 ? 3 : count <= 6 ? 2 : 1; }
function award(place: number) { return place === 1 ? 10 : place === 2 ? 8 : place === 3 ? 6 : place === 4 ? 4 : 1; }

async function pickQuestion(sessionId: string) {
  const questions = await loadQuestions();
  const { data: history } = await supabase.from("question_history").select("question_id").eq("session_id", sessionId);
  const used = new Set((history || []).map((row) => row.question_id));
  const eligible = questions.filter((q: any) => q.question_id && q.question_text && q.answer && !used.has(q.question_id));
  if (!eligible.length) throw new Error("No unused Aging Room questions are available.");
  return eligible[Math.floor(Math.random() * eligible.length)];
}

async function setQuestion(game: any, phase: string) {
  const question: any = await pickQuestion(game.session_id);
  const questionNumber = Number(game.question_number || 0) + 1;
  await supabase.from("question_history").insert({ question_id: question.question_id, session_id: game.session_id, game_mode: "aging_room", date_used: new Date().toISOString(), question_text: question.question_text, category: question.category, subcategory: question.subcategory, difficulty: question.difficulty, correct_answer: question.answer });
  const values = { phase, question_number: questionNumber, attempt_number: 1, question_id: question.question_id, category: question.category, subcategory: question.subcategory, difficulty: question.difficulty, question_text: question.question_text, correct_answer: question.answer, answer_aliases: question.answer_aliases || "", eliminated_player_id: null, updated_at: new Date().toISOString() };
  await supabase.from("aging_room_games").update(values).eq("id", game.id);
  await supabase.from("sessions").update({ game_mode: "aging_room", question_status: phase, current_question_id: question.question_id, current_category: question.category, current_subcategory: question.subcategory, current_difficulty: question.difficulty, current_question_text: question.question_text, current_answer: question.answer, current_answer_aliases: question.answer_aliases || "", question_started_at: new Date().toISOString(), question_ends_at: null, question_duration_seconds: null, show_answer: false }).eq("id", game.session_id);
  return values;
}

async function finish(game: any, winnerId: string) {
  const { data: rows } = await supabase.from("aging_room_players").select("*").eq("game_id", game.id);
  const winner = (rows || []).find((p) => p.player_id === winnerId);
  const loser = (rows || []).find((p) => p.status !== "eliminated" && p.player_id !== winnerId);
  if (winner) await supabase.from("aging_room_players").update({ status: "winner", final_place: 1 }).eq("id", winner.id);
  if (loser) await supabase.from("aging_room_players").update({ status: "eliminated", final_place: 2 }).eq("id", loser.id);
  const finalRows = (rows || []).filter((p) => p.status !== "excluded").map((p) => p.player_id === winnerId ? { ...p, final_place: 1 } : p.player_id === loser?.player_id ? { ...p, final_place: 2 } : p);
  for (const row of finalRows) {
    if (row.session_points_awarded !== null) continue;
    const points = award(Number(row.final_place || finalRows.length));
    const { data: current } = await supabase.from("players").select("score").eq("id", row.player_id).single();
    await supabase.from("players").update({ score: Number(current?.score || 0) + points }).eq("id", row.player_id);
    await supabase.from("aging_room_players").update({ session_points_awarded: points }).eq("id", row.id);
  }
  await recordGameResult(game.session_id, game.id, "aging_room", finalRows
    .filter((row) => row.final_place)
    .map((row) => ({
      player_id: row.player_id,
      player_name: row.player_name,
      place: Number(row.final_place),
      game_score: row.player_id === winnerId ? 5 : Number(row.bale_count || 0),
    })));
  await supabase.from("aging_room_games").update({ phase: "complete", status: "completed", winner_player_id: winnerId, updated_at: new Date().toISOString() }).eq("id", game.id);
  await supabase.from("sessions").update({ game_mode: "aging_room", question_status: "aging_room_complete", current_question_id: null, current_question_text: null, current_answer: null, current_answer_aliases: null, current_category: null, current_subcategory: null, current_difficulty: null, show_answer: false }).eq("id", game.session_id);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, sessionId, playerId } = body;
    if (!sessionId || !action) return NextResponse.json({ error: "sessionId and action are required." }, { status: 400 });
    let { data: game } = await supabase.from("aging_room_games").select("*").eq("session_id", sessionId).maybeSingle();

    if (action === "setup") {
      if (game?.status === "closed") { await supabase.from("aging_room_games").delete().eq("id", game.id); game = null; }
      if (game) return NextResponse.json({ success: true, game });
      const { data: players } = await supabase.from("players").select("id,display_name").eq("session_id", sessionId).order("display_name");
      if (!players?.length) return NextResponse.json({ error: "No players have joined this session." }, { status: 400 });
      const created = await supabase.from("aging_room_games").insert({ session_id: sessionId }).select("*").single();
      if (created.error) throw created.error; game = created.data;
      await supabase.from("aging_room_players").insert(players.map((p) => ({ game_id: game!.id, player_id: p.id, player_name: p.display_name, status: "selected" })));
      return NextResponse.json({ success: true, game });
    }
    if (!game) return NextResponse.json({ error: "Aging Room has not been set up." }, { status: 404 });

    if (action === "set_selected") {
      if (game.phase !== "setup") return NextResponse.json({ error: "The player list is already locked." }, { status: 409 });
      const selected = new Set<string>(body.playerIds || []);
      const { data: rows } = await supabase.from("aging_room_players").select("*").eq("game_id", game.id);
      for (const row of rows || []) await supabase.from("aging_room_players").update({ status: selected.has(row.player_id) ? "selected" : "excluded" }).eq("id", row.id);
      return NextResponse.json({ success: true });
    }
    if (action === "start") {
      const { data: selected } = await supabase.from("aging_room_players").select("*").eq("game_id", game.id).eq("status", "selected");
      const count = selected?.length || 0;
      if (count < 2) return NextResponse.json({ error: "Select at least two players." }, { status: 400 });
      for (const row of selected || []) await supabase.from("aging_room_players").update({ status: "active", round_correct: 0 }).eq("id", row.id);
      const phase = count === 2 ? "bale_question" : "question";
      const base = { ...game, round_number: count === 2 ? 0 : 1, required_correct: count === 2 ? 5 : requiredFor(count), status: "active" };
      await supabase.from("aging_room_games").update({ round_number: base.round_number, required_correct: base.required_correct, status: "active" }).eq("id", game.id);
      await setQuestion(base, phase);
      return NextResponse.json({ success: true });
    }
    if (action === "submit") {
      if (!["question", "bale_question"].includes(game.phase)) return NextResponse.json({ error: "Answers are not open." }, { status: 409 });
      const { data: row } = await supabase.from("aging_room_players").select("*").eq("game_id", game.id).eq("player_id", playerId).maybeSingle();
      if (!row || row.status === "excluded") return NextResponse.json({ error: "You are not playing this Aging Room game." }, { status: 403 });
      const competitive = game.phase === "bale_question" ? ["active", "finalist"].includes(row.status) : row.status === "active";
      const result = await supabase.from("aging_room_answers").insert({ game_id: game.id, player_id: playerId, question_number: game.question_number, attempt_number: game.attempt_number, submitted_answer: String(body.answer || "").trim(), competitive });
      if (result.error?.code === "23505") return NextResponse.json({ error: "You already answered this attempt." }, { status: 409 });
      if (result.error) throw result.error;
      return NextResponse.json({ success: true, competitive });
    }
    if (action === "retry") {
      if (!["question", "bale_question"].includes(game.phase)) return NextResponse.json({ error: "This question is not open." }, { status: 409 });
      const eligibleStatuses = game.phase === "bale_question" ? ["active", "finalist"] : ["active"];
      const { data: eligible } = await supabase.from("aging_room_players").select("player_id").eq("game_id", game.id).in("status", eligibleStatuses);
      const { data: tried } = await supabase.from("aging_room_answers").select("player_id").eq("game_id", game.id).eq("question_number", game.question_number).eq("attempt_number", game.attempt_number).eq("competitive", true);
      if ((tried || []).length < (eligible || []).length) return NextResponse.json({ error: "Every eligible player must try before second attempts are opened." }, { status: 409 });
      await supabase.from("aging_room_games").update({ attempt_number: Number(game.attempt_number) + 1, updated_at: new Date().toISOString() }).eq("id", game.id);
      return NextResponse.json({ success: true });
    }
    if (action === "grade") {
      if (!["question", "bale_question"].includes(game.phase)) return NextResponse.json({ error: "This question cannot be graded." }, { status: 409 });
      const correctIds = new Set<string>(body.correctAnswerIds || []);
      const { data: answers } = await supabase.from("aging_room_answers").select("*").eq("game_id", game.id).eq("question_number", game.question_number).eq("attempt_number", game.attempt_number).order("submitted_at");
      for (const answer of answers || []) await supabase.from("aging_room_answers").update({ is_correct: correctIds.has(answer.id) }).eq("id", answer.id);
      const fastest = (answers || []).find((a) => a.competitive && correctIds.has(a.id));
      if (fastest) {
        const { data: row } = await supabase.from("aging_room_players").select("*").eq("game_id", game.id).eq("player_id", fastest.player_id).single();
        if (game.phase === "bale_question") {
          const count = Number(row.bale_count || 0) + 1;
          await supabase.from("aging_room_players").update({ bale_count: count, status: "finalist" }).eq("id", row.id);
          if (count >= 5) { await finish(game, row.player_id); return NextResponse.json({ success: true, winnerId: row.player_id }); }
        } else {
          const count = Number(row.round_correct || 0) + 1;
          await supabase.from("aging_room_players").update({ round_correct: count, status: count >= Number(game.required_correct) ? "passed" : "active" }).eq("id", row.id);
        }
      }
      await supabase.from("aging_room_games").update({ phase: game.phase === "bale_question" ? "bale_result" : "question_result", updated_at: new Date().toISOString() }).eq("id", game.id);
      return NextResponse.json({ success: true, fastestPlayerId: fastest?.player_id || null });
    }
    if (action === "next_question") {
      const nextPhase = game.phase === "bale_result" ? "bale_question" : "question";
      await setQuestion(game, nextPhase);
      return NextResponse.json({ success: true });
    }
    if (action === "check_round") {
      const { data: active } = await supabase.from("aging_room_players").select("*").eq("game_id", game.id).eq("status", "active");
      if ((active || []).length !== 1) return NextResponse.json({ error: "The round still has more than one active player." }, { status: 409 });
      const eliminated = active![0];
      const { data: remaining } = await supabase.from("aging_room_players").select("*").eq("game_id", game.id).in("status", ["active", "passed"]);
      await supabase.from("aging_room_players").update({ status: "eliminated", final_place: remaining?.length || 1 }).eq("id", eliminated.id);
      await supabase.from("aging_room_games").update({ phase: "elimination", eliminated_player_id: eliminated.player_id }).eq("id", game.id);
      return NextResponse.json({ success: true });
    }
    if (action === "next_round") {
      const { data: survivors } = await supabase.from("aging_room_players").select("*").eq("game_id", game.id).eq("status", "passed");
      if ((survivors || []).length === 2) {
        for (const row of survivors || []) await supabase.from("aging_room_players").update({ status: "finalist", round_correct: 0 }).eq("id", row.id);
        await setQuestion({ ...game, required_correct: 5 }, "bale_question");
        await supabase.from("aging_room_games").update({ required_correct: 5, round_number: Number(game.round_number) + 1 }).eq("id", game.id);
      } else {
        for (const row of survivors || []) await supabase.from("aging_room_players").update({ status: "active", round_correct: 0 }).eq("id", row.id);
        const required = requiredFor(survivors?.length || 0);
        await setQuestion({ ...game, required_correct: required }, "question");
        await supabase.from("aging_room_games").update({ required_correct: required, round_number: Number(game.round_number) + 1 }).eq("id", game.id);
      }
      return NextResponse.json({ success: true });
    }
    if (action === "close") {
      if (game.phase !== "complete") return NextResponse.json({ error: "The Aging Room is not complete." }, { status: 409 });
      await supabase.from("aging_room_games").update({ status: "closed" }).eq("id", game.id);
      await supabase.from("sessions").update({ game_mode: "main", question_status: "closed", current_question_id: null, current_question_text: null, current_answer: null, current_answer_aliases: null, current_category: null, current_subcategory: null, current_difficulty: null, show_answer: false }).eq("id", sessionId);
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: "Unknown Aging Room action." }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Aging Room action failed." }, { status: 500 });
  }
}
