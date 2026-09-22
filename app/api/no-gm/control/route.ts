import { NextResponse } from "next/server";
import { requireAnonymousPlayer } from "@/lib/noGmAuth";

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireAnonymousPlayer(request); const body = await request.json();
    const { sessionId, action } = body;
    const { data: player } = await supabase.from("players").select("id").eq("session_id", sessionId).eq("auth_user_id", user.id).single();
    const { data: control } = await supabase.from("session_controls").select("*").eq("session_id", sessionId).single();
    if (!player || !control) return NextResponse.json({ error: "Game player not found." }, { status: 404 });
    const isDecisionPlayer = control.decision_player_id === player.id;
    if (action === "resume" && control.state === "timeout") {
      const { error } = await supabase.rpc("resume_no_gm_session", { p_session_id: sessionId });
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }
    if (action === "finalize_timeout" && control.state === "timeout") {
      const { error } = await supabase.rpc("finalize_no_gm_timeout", { p_session_id: sessionId });
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }
    if (!isDecisionPlayer) return NextResponse.json({ error: "The current decision player chooses the next move." }, { status: 403 });
    if (action === "end_mode") {
      await supabase.from("sessions").update({ game_mode: "main", question_status: "lobby", current_question_id: null, current_question_text: null, current_answer: null, current_answer_aliases: null, show_answer: false }).eq("id", sessionId);
      const { error } = await supabase.from("session_controls").update({ state: "lobby", last_activity_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("session_id", sessionId);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }
    if (action === "start_main") {
      const { error } = await supabase.from("session_controls").update({ state: "main_active", last_activity_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("session_id", sessionId); if (error) throw error;
      await supabase.from("sessions").update({ game_mode: "main", question_status: "ready", current_question_id: null, current_question_text: null, show_answer: false }).eq("id", sessionId);
      return NextResponse.json({ ok: true });
    }
    if (action === "end_session" || action === "end") {
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
