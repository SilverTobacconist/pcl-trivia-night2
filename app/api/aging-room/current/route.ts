import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { normalizeAnswer } from "@/lib/questions";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const sessionId = params.get("sessionId");
  const playerId = params.get("playerId");
  if (!sessionId) return NextResponse.json({ error: "sessionId is required." }, { status: 400 });
  const { data: game, error } = await supabase.from("aging_room_games").select("*").eq("session_id", sessionId).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!game || game.status === "closed") return NextResponse.json({ game: null, players: [], answers: [], player: null, answer: null });
  const { data: players } = await supabase.from("aging_room_players").select("*").eq("game_id", game.id).order("final_place", { ascending: true, nullsFirst: true }).order("player_name");
  const { data: answers } = await supabase.from("aging_room_answers").select("*").eq("game_id", game.id).eq("question_number", game.question_number).eq("attempt_number", game.attempt_number).order("submitted_at");
  const accepted = [game.correct_answer || "", ...String(game.answer_aliases || "").split(/[,;|]/)].map(normalizeAnswer).filter(Boolean);
  const enriched = (answers || []).map((answer) => ({ ...answer, player_name: (players || []).find((p) => p.player_id === answer.player_id)?.player_name || "Unknown", exact_match: accepted.includes(normalizeAnswer(answer.submitted_answer || "")) }));
  const fastestCorrect = enriched.find((answer) => answer.competitive && answer.is_correct);
  return NextResponse.json({
    game,
    players: players || [],
    answers: enriched,
    player: playerId ? (players || []).find((p) => p.player_id === playerId) || null : null,
    answer: playerId ? enriched.find((a) => a.player_id === playerId) || null : null,
    playerWasFastest: Boolean(playerId && fastestCorrect?.player_id === playerId),
  }, { headers: { "Cache-Control": "no-store" } });
}
