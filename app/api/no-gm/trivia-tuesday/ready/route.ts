import { NextResponse } from "next/server";
import { requireAnonymousPlayer } from "@/lib/noGmAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireAnonymousPlayer(request); const { sessionId } = await request.json();
    const [{ data: player }, { data: session }] = await Promise.all([
      supabase.from("players").select("id,left_at").eq("session_id", sessionId).eq("auth_user_id", user.id).single(),
      supabase.from("sessions").select("trivia_tuesday_event_id,trivia_tuesday_phase").eq("id",sessionId).single(),
    ]);
    if (!player || player.left_at || !session?.trivia_tuesday_event_id) return NextResponse.json({ error:"Trivia Tuesday game not found." },{status:404});
    const admin=getSupabaseAdmin(); const {data:event}=await admin.from("trivia_tuesday_events").select("scheduled_start_at,status").eq("id",session.trivia_tuesday_event_id).single();
    if(!event || ["completed","cancelled"].includes(event.status) || Date.now()<new Date(event.scheduled_start_at).getTime()) return NextResponse.json({error:"Trivia Tuesday has not reached its start time."},{status:409});
    const now=new Date().toISOString(); await admin.from("players").update({trivia_tuesday_ready_at:now}).eq("id",player.id);
    await admin.from("sessions").update({trivia_tuesday_phase:"ready_check",trivia_tuesday_ready_last_at:now}).eq("id",sessionId).neq("trivia_tuesday_phase","seasonal");
    return NextResponse.json({ok:true});
  } catch(error:any) { return NextResponse.json({error:error.message||"Could not mark you ready."},{status:500}); }
}
