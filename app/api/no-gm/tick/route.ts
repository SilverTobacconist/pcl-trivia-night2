import { NextResponse } from "next/server";
import { requireAnonymousPlayer } from "@/lib/noGmAuth";
import { loadQuestions, normalizeAnswer } from "@/lib/questions";
import { usedQuestionIdsForLocation } from "@/lib/noGmQuestions";

const QUESTION_SECONDS = 60;
const REVEAL_SECONDS = 15;
const INACTIVITY_MS = 10 * 60 * 1000;

function pointsFor(difficulty: string | null) {
  const value = String(difficulty || "").toLowerCase();
  if (value.includes("extra")) return 5;
  if (value.includes("hard")) return 3;
  if (value.includes("medium")) return 2;
  return 1;
}

async function exportLeaderboard(supabase: any, sessionId: string, reason: "completed" | "timeout") {
  const { data: leaderboard } = await supabase.from("players").select("id,display_name,score").eq("session_id", sessionId).order("score", { ascending: false });
  await supabase.from("session_leaderboard_exports").upsert({ session_id: sessionId, reason, leaderboard: leaderboard || [] }, { onConflict: "session_id" });
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireAnonymousPlayer(request); const { sessionId } = await request.json();
    const [{ data: player }, { data: control }, { data: session }] = await Promise.all([
      supabase.from("players").select("id").eq("session_id", sessionId).eq("auth_user_id", user.id).single(),
      supabase.from("session_controls").select("*").eq("session_id", sessionId).single(),
      supabase.from("sessions").select("*").eq("id", sessionId).single(),
    ]);
    if (!player || !control || !session) return NextResponse.json({ error: "Game not found." }, { status: 404 });
    if (control.decision_player_id !== player.id || control.state !== "main_active") return NextResponse.json({ ok: true });
    const now = new Date();
    const [{ data: newestAnswer }, { data: newestVote }] = await Promise.all([
      supabase.from("answers").select("submitted_at").eq("session_id", sessionId).order("submitted_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("answer_dispute_votes").select("voted_at,answer_disputes!inner(session_id)").eq("answer_disputes.session_id", sessionId).order("voted_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    const activityTimes = [control.last_activity_at, newestAnswer?.submitted_at, newestVote?.voted_at].filter(Boolean).map((value: string) => new Date(value).getTime());
    const lastActivity = Math.max(...activityTimes);
    if (now.getTime() - lastActivity >= INACTIVITY_MS) {
      await supabase.from("session_controls").update({ state: "timeout", timeout_at: now.toISOString(), updated_at: now.toISOString() }).eq("session_id", sessionId);
      return NextResponse.json({ ok: true, timeout: true });
    }
    const { data: openDispute } = await supabase.from("answer_disputes").select("*").eq("session_id", sessionId).eq("status", "open").maybeSingle();
    if (openDispute) {
      if (now.getTime() < new Date(openDispute.closes_at).getTime()) return NextResponse.json({ ok: true });
      const [{ data: votes }, { count: playerCount }, { data: answer }, { data: controlVote }] = await Promise.all([
        supabase.from("answer_dispute_votes").select("vote_yes").eq("dispute_id", openDispute.id),
        supabase.from("players").select("id", { count: "exact", head: true }).eq("session_id", sessionId),
        supabase.from("answers").select("id,player_id,is_correct,points_awarded").eq("id", openDispute.answer_id).single(),
        supabase.from("answer_dispute_votes").select("vote_yes").eq("dispute_id", openDispute.id).eq("player_id", control.decision_player_id).maybeSingle(),
      ]);
      const yes = (votes || []).filter((vote: any) => vote.vote_yes).length;
      const no = (votes || []).length - yes;
      const approved = yes > no || (yes === no && controlVote?.vote_yes === true);
      await supabase.from("answer_disputes").update({ status: approved ? "approved" : "rejected", resolved_at: now.toISOString() }).eq("id", openDispute.id);
      if (approved && answer && !answer.is_correct) {
        const earned = pointsFor(session.current_difficulty);
        await supabase.from("answers").update({ is_correct: true, points_awarded: earned }).eq("id", answer.id);
        const { data: owner } = await supabase.from("players").select("score").eq("id", answer.player_id).single();
        await supabase.from("players").update({ score: Number(owner?.score || 0) + earned }).eq("id", answer.player_id);
      }
      return NextResponse.json({ ok: true, disputeResolved: true });
    }
    if (session.question_status === "active" && session.question_ends_at && now.getTime() >= new Date(session.question_ends_at).getTime()) {
      const { data: answers } = await supabase.from("answers").select("id,player_id,submitted_answer,is_correct").eq("session_id", sessionId).eq("question_id", session.current_question_id);
      const accepted = [session.current_answer, ...(String(session.current_answer_aliases || "").split(/[;,]/))].filter(Boolean).map((answer: string) => normalizeAnswer(answer));
      for (const answer of answers || []) {
        const correct = accepted.includes(normalizeAnswer(answer.submitted_answer)); const earned = correct ? pointsFor(session.current_difficulty) : 0;
        await supabase.from("answers").update({ is_correct: correct, points_awarded: earned }).eq("id", answer.id);
        if (correct) { const { data: owner } = await supabase.from("players").select("score").eq("id", answer.player_id).single(); await supabase.from("players").update({ score: Number(owner?.score || 0) + earned }).eq("id", answer.player_id); }
      }
      await supabase.from("sessions").update({ question_status: "revealed", show_answer: true }).eq("id", sessionId);
      return NextResponse.json({ ok: true, revealed: true });
    }
    if (session.question_status === "revealed" && session.question_ends_at && now.getTime() >= new Date(session.question_ends_at).getTime() + REVEAL_SECONDS * 1000) {
      if (control.pending_action === "end_mode") {
        await supabase.from("sessions").update({ game_mode: "main", question_status: "lobby", current_question_id: null, current_question_text: null, current_answer: null, current_answer_aliases: null, show_answer: false }).eq("id", sessionId);
        await supabase.from("session_controls").update({ state: "lobby", pending_action: null, updated_at: now.toISOString() }).eq("session_id", sessionId);
        return NextResponse.json({ ok: true, endedMode: true });
      }
      if (control.pending_action === "end_session") {
        const { error } = await supabase.from("last_call_games").insert({ session_id: sessionId, phase: "voting", phase_started_at: now.toISOString() });
        if (error && error.code !== "23505") throw error;
        await supabase.from("sessions").update({ game_mode: "last_call", question_status: "last_call_voting", current_question_id: null, current_question_text: null, current_answer: null, current_answer_aliases: null, show_answer: false }).eq("id", sessionId);
        await supabase.from("session_controls").update({ pending_action: null, updated_at: now.toISOString() }).eq("session_id", sessionId);
        return NextResponse.json({ ok: true, lastCall: true });
      }
      await supabase.from("sessions").update({ question_status: "ready", current_question_id: null, current_question_text: null, show_answer: false }).eq("id", sessionId);
      return NextResponse.json({ ok: true });
    }
    if (session.question_status !== "ready") return NextResponse.json({ ok: true });
    const allQuestions = (await loadQuestions()).filter((question: any) => question.question_id && question.question_text);
    const usedIds = await usedQuestionIdsForLocation(supabase, session.location, ["main", "last_call"]);
    const candidates = allQuestions.filter((question: any) => !usedIds.has(question.question_id));
    const questionNumber = Number(control.main_question_count || 0) + 1;
    const frequency = Number(control.keyword_trivia_frequency || 0);
    const keyword = String(control.keyword_trivia_term || "").trim().toLowerCase();
    const shouldFeatureKeyword = session.game_mode === "keyword_trivia" && keyword && frequency > 0 && questionNumber % frequency === 0;
    const keywordHistoryMode = `keyword:${keyword}`;
    let pool = candidates;
    let historyMode = "main";
    if (shouldFeatureKeyword) {
      const keywordCandidates = allQuestions.filter((question: any) => `${question.category || ""} ${question.subcategory || ""}`.toLowerCase().includes(keyword));
      if (keywordCandidates.length) {
        const { data: askedKeywordQuestions, error: keywordHistoryError } = await supabase.from("question_history").select("id,question_id").eq("session_id", sessionId).eq("game_mode", keywordHistoryMode);
        if (keywordHistoryError) throw keywordHistoryError;
        const askedIds = new Set((askedKeywordQuestions || []).map((row: any) => row.question_id));
        const unaskedKeywordCandidates = keywordCandidates.filter((question: any) => !askedIds.has(question.question_id));
        if (unaskedKeywordCandidates.length) {
          pool = unaskedKeywordCandidates;
        } else {
          // The whole keyword deck has been used.  Start a freshly shuffled pass.
          const { error: resetError } = await supabase.from("question_history").delete().eq("session_id", sessionId).eq("game_mode", keywordHistoryMode);
          if (resetError) throw resetError;
          pool = keywordCandidates;
        }
        historyMode = keywordHistoryMode;
      }
    }
    if (!pool.length) {
      await exportLeaderboard(supabase, sessionId, "completed");
      await supabase.from("session_controls").update({ state: "ended", ended_at: now.toISOString(), exported_at: now.toISOString() }).eq("session_id", sessionId);
      await supabase.from("sessions").update({ status: "ended", game_mode: "complete", question_status: "closed" }).eq("id", sessionId);
      return NextResponse.json({ ok: true, ended: true });
    }
    const question = pool[Math.floor(Math.random() * pool.length)]; const endsAt = new Date(now.getTime() + QUESTION_SECONDS * 1000);
    await supabase.from("question_history").insert({ question_id: question.question_id, session_id: sessionId, game_mode: historyMode, date_used: now.toISOString(), question_text: question.question_text, category: question.category, subcategory: question.subcategory, difficulty: question.difficulty, correct_answer: question.answer });
    await supabase.from("sessions").update({ current_question_id: question.question_id, current_question_text: question.question_text, current_category: question.category, current_subcategory: question.subcategory, current_difficulty: question.difficulty, current_answer: question.answer, current_answer_aliases: question.answer_aliases, question_started_at: now.toISOString(), question_ends_at: endsAt.toISOString(), question_duration_seconds: QUESTION_SECONDS, question_status: "active", show_answer: false }).eq("id", sessionId);
    await supabase.from("session_controls").update({ main_question_count: Number(control.main_question_count || 0) + 1, updated_at: now.toISOString() }).eq("session_id", sessionId);
    return NextResponse.json({ ok: true, questionStarted: true });
  } catch (error: any) { return NextResponse.json({ error: error.message || "Could not advance game." }, { status: 500 }); }
}
