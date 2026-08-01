import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function POST(request: Request) {
  try {
    const { gameId } = await request.json();

    if (!gameId) {
      return NextResponse.json(
        { error: "gameId is required." },
        { status: 400 }
      );
    }

    const { data: game, error: gameError } = await supabase
      .from("rickhouse_games")
      .select("*")
      .eq("id", gameId)
      .single();

    if (gameError || !game) {
      return NextResponse.json(
        { error: "Rickhouse game not found." },
        { status: 404 }
      );
    }

    if (game.game_phase !== "board") {
      return NextResponse.json(
        {
          error:
            "The picker can only be skipped while the board is open.",
        },
        { status: 400 }
      );
    }

    const { data: players, error: playersError } = await supabase
      .from("players")
      .select("id, display_name, joined_at")
      .eq("session_id", game.session_id)
      .order("joined_at", { ascending: true });

    if (playersError) {
      return NextResponse.json(
        { error: playersError.message },
        { status: 500 }
      );
    }

    if (!players || players.length < 2) {
      return NextResponse.json(
        { error: "There is no next player to select." },
        { status: 400 }
      );
    }

    const currentIndex = players.findIndex(
      (player) => player.id === game.current_picker_player_id
    );

    const nextPlayer =
      players[(currentIndex < 0 ? 0 : currentIndex + 1) % players.length];

    const { data: updatedGame, error: updateError } = await supabase
      .from("rickhouse_games")
      .update({ current_picker_player_id: nextPlayer.id })
      .eq("id", gameId)
      .select("*")
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      game: updatedGame,
      picker: nextPlayer,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Unknown error." },
      { status: 500 }
    );
  }
}