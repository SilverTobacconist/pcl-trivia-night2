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
    if (action === "start_main") {
      const { error } = await supabase.from("session_controls").update({ state: "main_active", last_activity_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("session_id", sessionId); if (error) throw error;
      await supabase.from("sessions").update({ game_mode: "main", question_status: "ready", current_question_id: null, current_question_text: null, show_answer: false }).eq("id", sessionId);
      return NextResponse.json({ ok: true });
    }
    if (action === "end") {
      const { data: leaderboard } = await supabase.from("players").select("id,display_name,score").eq("session_id", sessionId).order("score", { ascending: false });
      const { error } = await supabase.from("session_leaderboard_exports").insert({ session_id: sessionId, reason: "bartender_ended", leaderboard: leaderboard || [] }); if (error && error.code !== "23505") throw error;
      await supabase.from("session_controls").update({ state: "ended", ended_at: new Date().toISOString(), exported_at: new Date().toISOString() }).eq("session_id", sessionId);
      await supabase.from("sessions").update({ status: "ended", game_mode: "complete", question_status: "closed", current_question_text: null, show_answer: false }).eq("id", sessionId);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error: any) { return NextResponse.json({ error: error.message || "Could not change the game." }, { status: 500 }); }
}
