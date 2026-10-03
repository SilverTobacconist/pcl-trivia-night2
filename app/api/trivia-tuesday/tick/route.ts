import { NextResponse } from "next/server";
import { requireAnonymousPlayer } from "@/lib/noGmAuth";
import { POST as startRickhouse } from "@/app/api/rickhouse/start/route";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

function forwarded(body:any) { return new Request("http://internal", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) }); }
export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireAnonymousPlayer(request); const { sessionId } = await request.json();
    const [{ data:session },{ data:player }] = await Promise.all([supabase.from("sessions").select("*").eq("id",sessionId).single(),supabase.from("players").select("id").eq("session_id",sessionId).eq("auth_user_id",user.id).maybeSingle()]);
    if (!session?.trivia_tuesday_event_id || !player) return NextResponse.json({ ok:true });
    // Every Trivia Tuesday game is manually started by its first player.
    return NextResponse.json({ ok:true });
    const admin = getSupabaseAdmin(); const { data:event } = await admin.from("trivia_tuesday_events").select("*").eq("id",session.trivia_tuesday_event_id).single();
    if (!event) return NextResponse.json({ ok:true });
    if (event.status === "completed" && !session.is_test) return NextResponse.json({ ok:true });
    const now = Date.now(); const startsAt = new Date(event.scheduled_start_at).getTime(); const lockAt = startsAt - 15 * 60 * 1000;
    if (!session.is_test && now >= lockAt && now < startsAt && session.trivia_tuesday_phase === "ordinary") {
      await admin.from("sessions").update({ trivia_tuesday_phase:"countdown", trivia_tuesday_theme:event.board_theme }).eq("id",sessionId);
      return NextResponse.json({ ok:true, countdown:true });
    }
    const startsNow = Boolean(session.is_test) || now >= startsAt;
    if (!startsNow || (!session.is_test && session.trivia_tuesday_phase === "seasonal") || (session.is_test && session.game_mode === "rickhouse")) return NextResponse.json({ ok:true });
    const pauseState = {
      game_mode:session.game_mode, question_status:session.question_status,
      current_question_id:session.current_question_id, current_question_text:session.current_question_text,
      current_category:session.current_category, current_subcategory:session.current_subcategory,
      current_difficulty:session.current_difficulty, current_answer:session.current_answer,
      current_answer_aliases:session.current_answer_aliases, question_started_at:session.question_started_at,
      question_ends_at:session.question_ends_at, question_duration_seconds:session.question_duration_seconds,
      show_answer:session.show_answer, paused_at:new Date().toISOString(),
    };
    if (!session.is_test) {
      if (session.game_mode === "rickhouse") await admin.from("rickhouse_games").update({ status:"paused" }).eq("session_id",sessionId).eq("status","active").is("trivia_tuesday_event_id",null);
      if (session.game_mode === "aging_room") await admin.from("aging_room_games").update({ status:"paused" }).eq("session_id",sessionId).eq("status","active");
      await admin.from("sessions").update({ trivia_tuesday_phase:"countdown", trivia_tuesday_theme:event.board_theme, trivia_tuesday_pause_state:pauseState }).eq("id",sessionId);
    }
    const response = await startRickhouse(forwarded({ sessionId, roundName:"single_cask", pickerPlayerId:player.id, triviaTuesdayEventId:event.id }));
    if (response.ok) {
      if (!session.is_test) await admin.from("sessions").update({ trivia_tuesday_phase:"seasonal" }).eq("id",sessionId);
      await supabase.from("session_controls").update({ state:"main_active", last_activity_at:new Date().toISOString(), updated_at:new Date().toISOString() }).eq("session_id", sessionId);
      if (!session.is_test) await admin.from("trivia_tuesday_events").update({ status:"live" }).eq("id",event.id);
    }
    return response;
  } catch (error:any) { return NextResponse.json({ error:error.message || "Could not start Trivia Tuesday." }, { status:500 }); }
}
