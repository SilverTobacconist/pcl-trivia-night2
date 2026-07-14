import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
function normalize(value:string){return value.toLowerCase().trim().replace(/[^a-z0-9\s]/g,"").replace(/\s+/g," ");}
export async function GET(request: Request) {
  const gameId = new URL(request.url).searchParams.get("gameId");
  if (!gameId) return NextResponse.json({ error: "gameId is required." }, { status: 400 });
  const { data: game } = await supabase.from("rickhouse_games").select("*").eq("id", gameId).single();
  const { data: entries, error } = await supabase.from("rickhouse_cask_strength_entries").select("*").eq("game_id", gameId).order("reveal_order", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const ids = (entries || []).map(e=>e.player_id); const { data: players } = await supabase.from("players").select("id, display_name").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  const accepted = [game?.cask_strength_correct_answer || "", ...String(game?.cask_strength_answer_aliases || "").split(/[,;|]/)].map(normalize).filter(Boolean);
  return NextResponse.json({ entries: (entries||[]).map(e=>({ ...e, player_name: players?.find(p=>p.id===e.player_id)?.display_name || "Unknown", exact_match: e.submitted_answer !== null && accepted.includes(normalize(e.submitted_answer)) })) });
}