import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
export async function POST(request: Request) {
  try {
    const { gameId, playerId, answer } = await request.json();
    const { data: entry } = await supabase.from("rickhouse_cask_strength_entries").select("id").eq("game_id", gameId).eq("player_id", playerId).maybeSingle();
    if (!entry) return NextResponse.json({ error: "You did not qualify for Cask Strength." }, { status: 403 });
    const { error } = await supabase.from("rickhouse_cask_strength_entries").update({ submitted_answer: String(answer || "").trim(), answer_submitted_at: new Date().toISOString() }).eq("id", entry.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (error:any) { return NextResponse.json({ error: error.message || "Unknown error." }, { status: 500 }); }
}