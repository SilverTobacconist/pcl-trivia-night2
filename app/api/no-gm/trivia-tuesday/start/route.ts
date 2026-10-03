import { NextResponse } from "next/server";
import { requireAnonymousPlayer } from "@/lib/noGmAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { POST as startRickhouse } from "@/app/api/rickhouse/start/route";

function forwarded(body:any) { return new Request("http://internal", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) }); }

export async function POST(request: Request) {
  try {
    const { supabase,user }=await requireAnonymousPlayer(request); const {sessionId}=await request.json();
    const [{data:player},{data:control},{data:session}]=await Promise.all([
      supabase.from("players").select("id,left_at").eq("session_id",sessionId).eq("auth_user_id",user.id).single(),
      supabase.from("session_controls").select("*").eq("session_id",sessionId).order("updated_at",{ascending:false}).limit(1).maybeSingle(),
      supabase.from("sessions").select("*").eq("id",sessionId).single(),
    ]);
    if(!player || player.left_at || !control || !session?.trivia_tuesday_event_id) return NextResponse.json({error:"Trivia Tuesday game not found."},{status:404});
    if(control.decision_player_id!==player.id) return NextResponse.json({error:"Only the first player—the controller—can start Trivia Tuesday."},{status:403});
    if(session.game_mode==="rickhouse") return NextResponse.json({error:"Trivia Tuesday is already underway."},{status:409});
    const admin=getSupabaseAdmin(); const {data:event}=await admin.from("trivia_tuesday_events").select("*").eq("id",session.trivia_tuesday_event_id).single();
    if(!event || ["completed","cancelled"].includes(event.status)) return NextResponse.json({error:"This Trivia Tuesday is no longer available."},{status:409});
    await admin.from("sessions").update({trivia_tuesday_phase:"seasonal",trivia_tuesday_theme:event.board_theme,game_mode:"rickhouse",question_status:"lobby"}).eq("id",sessionId);
    const response=await startRickhouse(forwarded({sessionId,roundName:"single_cask",pickerPlayerId:player.id,triviaTuesdayEventId:event.id}));
    if(response.ok){await supabase.from("session_controls").update({state:"main_active",last_activity_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("session_id",sessionId);await admin.from("trivia_tuesday_events").update({status:"live"}).eq("id",event.id);}
    return response;
  } catch(error:any){return NextResponse.json({error:error.message||"Could not start Trivia Tuesday."},{status:500});}
}
