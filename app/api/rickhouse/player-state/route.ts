import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const sessionId = searchParams.get("sessionId");
  const playerId = searchParams.get("playerId");

  if (!sessionId || !playerId) {
    return NextResponse.json(
      { error: "sessionId and playerId are required." },
      { status: 400 }
    );
  }

  const { data: game, error: gameError } = await supabase
    .from("rickhouse_games")
    .select("*")
    .eq("session_id", sessionId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (gameError || !game) {
    return NextResponse.json(
      { error: "No active Rickhouse game found." },
      { status: 404 }
    );
  }

  const { data: pours, error: poursError } = await supabase
    .from("rickhouse_pours")
    .select("*")
    .eq("game_id", game.id)
    .order("column_index", { ascending: true })
    .order("row_index", { ascending: true });

  if (poursError) {
    return NextResponse.json(
      { error: poursError.message },
      { status: 500 }
    );
  }

  const { data: picker } = await supabase
    .from("players")
    .select("id, display_name")
    .eq("id", game.current_picker_player_id)
    .maybeSingle();

  const { data: playerScoreRow } = await supabase
    .from("rickhouse_scores")
    .select("score")
    .eq("game_id", game.id)
    .eq("player_id", playerId)
    .maybeSingle();

  if (!playerScoreRow) {
    await supabase.from("rickhouse_scores").insert({
      game_id: game.id,
      session_id: sessionId,
      player_id: playerId,
      score: 0,
    });
  }

  const activePour = game.current_pour_id
    ? pours?.find((pour) => pour.id === game.current_pour_id)
    : null;

  const currentScore = playerScoreRow?.score ?? 0;
  const minimumWagerLimit =
    game.round_name === "double_cask" ? 2000 : 1000;

  const maxWager = Math.max(currentScore, minimumWagerLimit);

  const { data: standingsRows } = await supabase
    .from("rickhouse_scores")
    .select("*")
    .eq("game_id", game.id)
    .order("score", { ascending: false });
  const standingPlayerIds = (standingsRows || []).map((row) => row.player_id);
  const { data: standingPlayers } = await supabase.from("players").select("id, display_name").in(
    "id", standingPlayerIds.length ? standingPlayerIds : ["00000000-0000-0000-0000-000000000000"]
  );
  const standings = (standingsRows || []).map((row) => ({ ...row, player_name: standingPlayers?.find((p) => p.id === row.player_id)?.display_name || "Unknown" }));
  const { data: caskStrengthEntry } = await supabase.from("rickhouse_cask_strength_entries").select("*").eq("game_id", game.id).eq("player_id", playerId).maybeSingle();

  return NextResponse.json({
    game,
    pours,
    picker,
    activePour,
    isCurrentPicker: game.current_picker_player_id === playerId,
    isAngelsSharePlayer: game.angels_share_player_id === playerId,
    playerScore: currentScore,
    maxWager,
    standings,
    caskStrengthEntry,
  });
}