import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
export async function POST(request: Request) {
  try {
    const { gameId, correctEntryIds = [] } = await request.json();
    const { data: game } = await supabase.from("rickhouse_games").select("*").eq("id", gameId).single();
    const { data: entries, error } = await supabase.from("rickhouse_cask_strength_entries").select("*").eq("game_id", gameId).order("reveal_order", { ascending: true });
    if (error || !game) return NextResponse.json({ error: error?.message || "Game not found." }, { status: 404 });
    for (const entry of entries || []) {
      const correct = correctEntryIds.includes(entry.id); const wager = Number(entry.wager || 0); const finalScore = Number(entry.starting_score) + (correct ? wager : -wager);
      await supabase.from("rickhouse_cask_strength_entries").update({ is_correct: correct, final_score: finalScore }).eq("id", entry.id);
    }
    await supabase.from("rickhouse_games").update({ game_phase: "cask_strength_reveal", cask_strength_reveal_index: 0 }).eq("id", gameId);
    await supabase.from("sessions").update({ question_status: "cask_strength_reveal", show_answer: true }).eq("id", game.session_id);
    return NextResponse.json({ success: true });
  } catch(error:any){return NextResponse.json({ error:error.message||"Unknown error."},{status:500});}
}