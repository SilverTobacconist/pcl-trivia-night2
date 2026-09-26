import { NextResponse } from "next/server";
import { requireAnonymousPlayer } from "@/lib/noGmAuth";

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireAnonymousPlayer(request); const body = await request.json();
    const { sessionId, action } = body;
    const { data: player } = await supabase.from("players").select("id,left_at").eq("session_id", sessionId).eq("auth_user_id", user.id).single();
    const { data: control } = await supabase.from("session_controls").select("*").eq("session_id", sessionId).order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (!player || !control) return NextResponse.json({ error: "Game player not found." }, { status: 404 });
    if (player.left_at) return NextResponse.json({ error: "You have left this game." }, { status: 403 });
    const isDecisionPlayer = control.decision_player_id === player.id;
    if (["resume", "take_control_and_resume"].includes(action) && control.state === "timeout") {
      const { error } = await supabase.rpc("resume_no_gm_session", { p_session_id: sessionId });
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }
    if (action === "finalize_timeout" && control.state === "timeout") {
      const { error } = await supabase.rpc("finalize_no_gm_timeout", { p_session_id: sessionId });
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }
    if (action === "leave") {
      if (isDecisionPlayer) {
        const { data: remaining } = await supabase.from("players").select("id").eq("session_id", sessionId).is("left_at", null).neq("id", player.id).order("joined_at");
        if (!(remaining || []).length) {
          const { data: leaderboard } = await supabase.from("players").select("id,display_name,score").eq("session_id", sessionId).order("score", { ascending: false });
          await supabase.from("players").update({ left_at: new Date().toISOString() }).eq("id", player.id);
          await supabase.from("session_leaderboard_exports").upsert({ session_id: sessionId, reason: "last_player_left", leaderboard: leaderboard || [] }, { onConflict: "session_id" });
          await supabase.from("session_controls").update({ state: "ended", ended_at: new Date().toISOString(), exported_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("session_id", sessionId);
          await supabase.from("sessions").update({ status: "ended", game_mode: "complete", question_status: "closed", show_answer: false }).eq("id", sessionId);
          return NextResponse.json({ ok: true, ended: true });
        }
        const next = (remaining || []).find((candidate: any) => candidate.id === body.targetPlayerId);
        if (!next) return NextResponse.json({ error: "Choose who will become the new Decision Player before leaving." }, { status: 400 });
        const { error } = await supabase.rpc("transfer_no_gm_control", { p_session_id: sessionId, p_target_player_id: next.id, p_leave_current: true });
        if (error) throw error;
        return NextResponse.json({ ok: true, passedTo: next.id });
      }
      await supabase.from("players").update({ left_at: new Date().toISOString() }).eq("id", player.id);
      return NextResponse.json({ ok: true });
    }
    if (!isDecisionPlayer) return NextResponse.json({ error: "The current decision player chooses the next move." }, { status: 403 });
    if (action === "pass_control") {
      const { data: target } = await supabase.from("players").select("id").eq("id", body.targetPlayerId).eq("session_id", sessionId).is("left_at", null).maybeSingle();
      if (!target) return NextResponse.json({ error: "Choose a player who is still in this game." }, { status: 400 });
      const { error } = await supabase.rpc("transfer_no_gm_control", { p_session_id: sessionId, p_target_player_id: target.id, p_leave_current: false });
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }
    if (action === "skip_question") {
      const { data: session } = await supabase.from("sessions").select("game_mode,question_status").eq("id", sessionId).single();
      if (session?.game_mode === "last_call") await supabase.from("last_call_games").update({ phase_started_at: new Date(Date.now() - 61_000).toISOString() }).eq("session_id", sessionId).is("completed_at", null);
      else if (session?.game_mode === "aging_room") await supabase.from("aging_room_games").update({ phase_started_at: new Date(Date.now() - 61_000).toISOString() }).eq("session_id", sessionId).eq("status", "active");
      else await supabase.from("sessions").update({ question_ends_at: new Date(Date.now() - 1000).toISOString() }).eq("id", sessionId).eq("question_status", "active");
      return NextResponse.json({ ok: true });
    }
    if (action === "end_mode") {
      const { data: session } = await supabase.from("sessions").select("question_status").eq("id", sessionId).single();
      if (session?.question_status === "active") {
        await supabase.from("session_controls").update({ pending_action: "end_mode", updated_at: new Date().toISOString() }).eq("session_id", sessionId);
        return NextResponse.json({ ok: true, afterQuestion: true });
      }
      await supabase.from("sessions").update({ game_mode: "main", question_status: "lobby", current_question_id: null, current_question_text: null, current_answer: null, current_answer_aliases: null, show_answer: false }).eq("id", sessionId);
      const { error } = await supabase.from("session_controls").update({ state: "lobby", last_activity_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("session_id", sessionId);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }
    if (action === "start_main") {
      const { error } = await supabase.from("session_controls").update({ state: "main_active", last_activity_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("session_id", sessionId); if (error) throw error;
      await supabase.from("session_controls").update({ keyword_trivia_term: null, keyword_trivia_frequency: null, main_question_count: 0 }).eq("session_id", sessionId);
      await supabase.from("sessions").update({ game_mode: "main", question_status: "ready", current_question_id: null, current_question_text: null, show_answer: false }).eq("id", sessionId);
      return NextResponse.json({ ok: true });
    }
    if (action === "start_keyword_trivia") {
      const term = String(body.keywordTerm || "").trim(); const frequency = Number(body.keywordFrequency);
      if (!term) return NextResponse.json({ error: "Enter the category or subcategory word to feature." }, { status: 400 });
      if (!Number.isInteger(frequency) || frequency < 1 || frequency > 20) return NextResponse.json({ error: "Choose a frequency between every question and every 20th question." }, { status: 400 });
      const { error } = await supabase.from("session_controls").update({ state: "main_active", keyword_trivia_term: term, keyword_trivia_frequency: frequency, main_question_count: 0, last_activity_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("session_id", sessionId);
      if (error) throw error;
      await supabase.from("sessions").update({ game_mode: "keyword_trivia", question_status: "ready", current_question_id: null, current_question_text: null, current_answer: null, current_answer_aliases: null, show_answer: false }).eq("id", sessionId);
      return NextResponse.json({ ok: true });
    }
    if (action === "end_session" || action === "end") {
      const { data: session } = await supabase.from("sessions").select("question_status").eq("id", sessionId).single();
      if (session?.question_status === "active") {
        await supabase.from("session_controls").update({ pending_action: "end_session", updated_at: new Date().toISOString() }).eq("session_id", sessionId);
        return NextResponse.json({ ok: true, afterQuestion: true });
      }
      const { data: existing } = await supabase.from("last_call_games").select("id").eq("session_id", sessionId).is("completed_at", null).maybeSingle();
      if (!existing) {
        const { error } = await supabase.from("last_call_games").insert({ session_id: sessionId, phase: "voting", phase_started_at: new Date().toISOString() });
        if (error) throw error;
      }
      await supabase.from("sessions").update({ game_mode: "last_call", question_status: "last_call_voting", current_question_id: null, current_question_text: null, current_answer: null, current_answer_aliases: null, show_answer: false }).eq("id", sessionId);
      await supabase.from("session_controls").update({ state: "main_active", last_activity_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("session_id", sessionId);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error: any) { return NextResponse.json({ error: error.message || "Could not change the game." }, { status: 500 }); }
}
