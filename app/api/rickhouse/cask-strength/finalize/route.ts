import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
const placementPoints = (place:number) => place===1?10:place===2?8:place===3?6:place===4?4:1;
export async function POST(request: Request) {
  try {
    const { gameId } = await request.json();
    const { data: game } = await supabase.from("rickhouse_games").select("*").eq("id", gameId).single();
    const { data: entries } = await supabase.from("rickhouse_cask_strength_entries").select("*").eq("game_id", gameId).order("final_score", { ascending:false });
    if (!game || !entries) return NextResponse.json({error:"Game not found."},{status:404});
    let index=0;
    while(index<entries.length){
      const tied=entries.filter(e=>Number(e.final_score)===Number(entries[index].final_score)); const startPlace=index+1;
      const pool=tied.reduce((sum,_e,offset)=>sum+placementPoints(startPlace+offset),0); const awarded=Math.ceil(pool/tied.length);
      for(const entry of tied){
        await supabase.from("rickhouse_cask_strength_entries").update({session_points_awarded:awarded}).eq("id",entry.id);
        const { data: player }=await supabase.from("players").select("score").eq("id",entry.player_id).single();
        await supabase.from("players").update({score:Number(player?.score||0)+awarded}).eq("id",entry.player_id);
      }
      index+=tied.length;
    }
    await supabase.from("rickhouse_games").update({game_phase:"cask_strength_complete",status:"active"}).eq("id",gameId);
    await supabase.from("sessions").update({question_status:"closed",current_question_id:null,current_question_text:null,current_answer:null,current_answer_aliases:null,question_started_at:null,question_ends_at:null,show_answer:false}).eq("id",game.session_id);
    return NextResponse.json({success:true});
  } catch(error:any){return NextResponse.json({error:error.message||"Unknown error."},{status:500});}
}