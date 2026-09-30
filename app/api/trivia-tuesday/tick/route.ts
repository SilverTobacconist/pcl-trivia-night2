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
    const admin = getSupabaseAdmin(); const { data:event } = await admin.from("trivia_tuesday_events").select("*").eq("id",session.trivia_tuesday_event_id).single();
    if (!event) return NextResponse.json({ ok:true });
    const startsNow = Boolean(session.is_test) || Date.now() >= new Date(event.scheduled_start_at).getTime();
    if (!startsNow || session.game_mode === "rickhouse") return NextResponse.json({ ok:true });
    const response = await startRickhouse(forwarded({ sessionId, roundName:"single_cask", pickerPlayerId:player.id, triviaTuesdayEventId:event.id }));
    if (response.ok) {
      await supabase.from("session_controls").update({ state:"main_active", last_activity_at:new Date().toISOString(), updated_at:new Date().toISOString() }).eq("session_id", sessionId);
      if (!session.is_test) await admin.from("trivia_tuesday_events").update({ status:"live" }).eq("id",event.id);
    }
    return response;
  } catch (error:any) { return NextResponse.json({ error:error.message || "Could not start Trivia Tuesday." }, { status:500 }); }
}
