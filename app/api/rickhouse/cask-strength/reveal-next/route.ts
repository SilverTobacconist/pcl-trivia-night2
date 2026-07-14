import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
export async function POST(request: Request) {
  try {
    const { gameId } = await request.json();
    const { data: game } = await supabase.from("rickhouse_games").select("*").eq("id", gameId).single();
    const { data: entries } = await supabase.from("rickhouse_cask_strength_entries").select("*").eq("game_id", gameId).order("reveal_order", { ascending: true });
    if (!game || !entries) return NextResponse.json({ error:"Game not found."},{status:404});
    const next = entries.find(e=>!e.is_revealed);
    if (!next) return NextResponse.json({ success:true, complete:true });
    await supabase.from("rickhouse_cask_strength_entries").update({ is_revealed:true }).eq("id", next.id);
    const score = Number(next.final_score ?? next.starting_score);
    await supabase.from("rickhouse_scores").update({ score }).eq("game_id", gameId).eq("player_id", next.player_id);
    await supabase.from("rickhouse_games").update({ cask_strength_reveal_index: Number(game.cask_strength_reveal_index||0)+1 }).eq("id", gameId);
    return NextResponse.json({ success:true, complete: entries.filter(e=>!e.is_revealed).length === 1 });
  } catch(error:any){return NextResponse.json({error:error.message||"Unknown error."},{status:500});}
}