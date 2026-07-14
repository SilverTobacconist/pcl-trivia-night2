import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const gameId = body.gameId;
    const pourId = body.pourId;
    const playerId = body.playerId;

    if (!gameId || !pourId || !playerId) {
      return NextResponse.json(
        { error: "gameId, pourId, and playerId are required." },
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

    if (game.status !== "active") {
      return NextResponse.json(
        { error: "Rickhouse game is not active." },
        { status: 400 }
      );
    }

    if (game.game_phase !== "board") {
      return NextResponse.json(
        { error: "Rickhouse is not ready for a new pour yet." },
        { status: 400 }
      );
    }

    if (game.current_picker_player_id !== playerId) {
      return NextResponse.json(
        { error: "It is not this player's turn to pick." },
        { status: 403 }
      );
    }

    const { data: pour, error: pourError } = await supabase
      .from("rickhouse_pours")
      .select("*")
      .eq("id", pourId)
      .eq("game_id", gameId)
      .single();

    if (pourError || !pour) {
      return NextResponse.json(
        { error: "Pour not found." },
        { status: 404 }
      );
    }

    if (pour.is_used) {
      return NextResponse.json(
        { error: "This pour has already been selected." },
        { status: 400 }
      );
    }

    const startedAt = new Date();
    const durationSeconds = 30;
    const endsAt = new Date(startedAt.getTime() + durationSeconds * 1000);

    const { error: pourUpdateError } = await supabase
      .from("rickhouse_pours")
      .update({
        is_used: true,
        selected_by_player_id: playerId,
        selected_at: startedAt.toISOString(),
      })
      .eq("id", pourId);

    if (pourUpdateError) {
      return NextResponse.json(
        { error: pourUpdateError.message },
        { status: 500 }
      );
    }

    const nextPhase = pour.is_angels_share ? "angels_wager" : "question";

    const { data: updatedGame, error: gameUpdateError } = await supabase
      .from("rickhouse_games")
      .update({
        current_pour_id: pourId,
        game_phase: nextPhase,
        angels_share_player_id: pour.is_angels_share ? playerId : null,
        angels_share_wager: null,
        angels_share_result: null,
        last_pour_result: null,
      })
      .eq("id", gameId)
      .select("*")
      .single();

    if (gameUpdateError || !updatedGame) {
      return NextResponse.json(
        { error: gameUpdateError?.message || "Could not update Rickhouse game." },
        { status: 500 }
      );
    }

    const { data: updatedSession, error: sessionUpdateError } = await supabase
      .from("sessions")
      .update({
        current_question_id: pour.is_angels_share ? null : pour.question_id,
        current_question_text: pour.is_angels_share ? null : pour.question_text,
        current_category: pour.category,
        current_subcategory: pour.subcategory,
        current_difficulty: pour.difficulty,
        current_answer: pour.correct_answer,
        current_answer_aliases: pour.answer_aliases,
        question_started_at: pour.is_angels_share ? null : startedAt.toISOString(),
        question_ends_at: pour.is_angels_share ? null : endsAt.toISOString(),
        question_duration_seconds: durationSeconds,
        question_status: pour.is_angels_share ? "waiting_wager" : "active",
        show_answer: false,
        game_mode: "rickhouse",
      })
      .eq("id", game.session_id)
      .select("*")
      .single();

    if (sessionUpdateError || !updatedSession) {
      return NextResponse.json(
        { error: sessionUpdateError?.message || "Could not update session." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      game: updatedGame,
      session: updatedSession,
      pour: {
        ...pour,
        is_used: true,
        selected_by_player_id: playerId,
        selected_at: startedAt.toISOString(),
      },
      is_angels_share: pour.is_angels_share,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Unknown error." },
      { status: 500 }
    );
  }
}