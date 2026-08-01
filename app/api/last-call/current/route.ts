import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { normalizeAnswer } from "@/lib/questions";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const sessionId = params.get("sessionId");
  const playerId = params.get("playerId");
  if (!sessionId) return NextResponse.json({ error: "sessionId is required." }, { status: 400 });

  const { data: game } = await supabase.from("last_call_games").select("*").eq("session_id", sessionId).maybeSingle();
  if (!game) return NextResponse.json({ game: null, entries: [], entry: null });
  const { data: rawEntries, error } = await supabase.from("last_call_entries").select("*").eq("game_id", game.id).order("reveal_order", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const ids = (rawEntries || []).map((entry) => entry.player_id);
  const { data: players } = await supabase.from("players").select("id, display_name, score").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  const accepted = [game.correct_answer || "", ...String(game.answer_aliases || "").split(/[,;|]/)].map(normalizeAnswer).filter(Boolean);
  const entries = (rawEntries || []).map((entry) => ({
    ...entry,
    player_name: players?.find((player) => player.id === entry.player_id)?.display_name || "Unknown",
    exact_match: entry.submitted_answer !== null && accepted.includes(normalizeAnswer(entry.submitted_answer)),
  }));
  return NextResponse.json({ game, entries, entry: playerId ? entries.find((entry) => entry.player_id === playerId) || null : null });
}

