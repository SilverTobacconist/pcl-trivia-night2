import { NextResponse } from "next/server";
import { requireAnonymousPlayer } from "@/lib/noGmAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { POST as start } from "@/app/api/no-gm/trivia-tuesday/start/route";

function forwarded(body:any, authorization:string) { return new Request("http://internal", {method:"POST",headers:{"Content-Type":"application/json",authorization},body:JSON.stringify(body)}); }
export async function POST(request:Request) {
  try {
    const { supabase,user }=await requireAnonymousPlayer(request); const {sessionId}=await request.json();
    const [{data:session},{data:player}]=await Promise.all([supabase.from("sessions").select("*").eq("id",sessionId).single(),supabase.from("players").select("id").eq("session_id",sessionId).eq("auth_user_id",user.id).maybeSingle()]);
    if(!session?.trivia_tuesday_event_id || !player || session.game_mode==="rickhouse") return NextResponse.json({ok:true});
    const admin=getSupabaseAdmin(); const {data:event}=await admin.from("trivia_tuesday_events").select("*").eq("id",session.trivia_tuesday_event_id).single();
    if(!event || ["completed","cancelled"].includes(event.status)) return NextResponse.json({ok:true});
    const now=Date.now(), startsAt=new Date(event.scheduled_start_at).getTime();
    if(now<startsAt) { await admin.from("sessions").update({trivia_tuesday_phase:"waiting_for_start",trivia_tuesday_theme:event.board_theme}).eq("id",sessionId); return NextResponse.json({ok:true,state:"waiting"}); }
    const {data:players}=await admin.from("players").select("id,trivia_tuesday_ready_at").eq("session_id",sessionId).is("left_at",null);
    const active=players||[], allReady=active.length>0 && active.every((entry:any)=>entry.trivia_tuesday_ready_at);
    if(allReady) return start(forwarded({sessionId},request.headers.get("authorization")||""));
    const lastReady=session.trivia_tuesday_ready_last_at ? new Date(session.trivia_tuesday_ready_last_at).getTime() : 0;
    if(lastReady && now-lastReady>=300000) {
      if(!session.trivia_tuesday_ready_countdown_at) await admin.from("sessions").update({trivia_tuesday_phase:"ready_countdown",trivia_tuesday_ready_countdown_at:new Date().toISOString()}).eq("id",sessionId);
      else if(now-new Date(session.trivia_tuesday_ready_countdown_at).getTime()>=10000) return start(forwarded({sessionId},request.headers.get("authorization")||""));
    } else await admin.from("sessions").update({trivia_tuesday_phase:"ready_check"}).eq("id",sessionId);
    return NextResponse.json({ok:true});
  } catch(error:any) { return NextResponse.json({error:error.message||"Could not update Trivia Tuesday."},{status:500}); }
}
