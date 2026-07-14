import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
export async function POST(request: Request) {
  try {
    const { gameId, playerId, wager } = await request.json(); const amount = Number(wager || 0);
    const { data: entry } = await supabase.from("rickhouse_cask_strength_entries").select("*").eq("game_id", gameId).eq("player_id", playerId).maybeSingle();
    if (!entry) return NextResponse.json({ error: "You did not qualify for Cask Strength." }, { status: 403 });
    if (!Number.isFinite(amount) || amount < 0 || amount > Number(entry.starting_score)) return NextResponse.json({ error: `Wager must be between 0 and ${entry.starting_score}.` }, { status: 400 });
    const { error } = await supabase.from("rickhouse_cask_strength_entries").update({ wager: Math.floor(amount), wager_submitted_at: new Date().toISOString() }).eq("id", entry.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, wager: Math.floor(amount) });
  } catch (error:any) { return NextResponse.json({ error: error.message || "Unknown error." }, { status: 500 }); }
}