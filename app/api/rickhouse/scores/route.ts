import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const gameId = searchParams.get("gameId");

  if (!gameId) {
    return NextResponse.json(
      { error: "gameId is required." },
      { status: 400 }
    );
  }

  const { data: scores, error } = await supabase
    .from("rickhouse_scores")
    .select("*")
    .eq("game_id", gameId)
    .order("score", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  const playerIds = [...new Set((scores || []).map((score) => score.player_id))];

  const { data: players } = await supabase
    .from("players")
    .select("id, display_name")
    .in(
      "id",
      playerIds.length > 0
        ? playerIds
        : ["00000000-0000-0000-0000-000000000000"]
    );

  const scoresWithPlayers = (scores || []).map((score) => {
    const player = players?.find((player) => player.id === score.player_id);

    return {
      ...score,
      player_name: player?.display_name ?? "Unknown",
    };
  });

  return NextResponse.json({
    scores: scoresWithPlayers,
  });
}