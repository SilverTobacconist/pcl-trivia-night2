import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const gameId = body.gameId;

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

    const { data: pours, error: poursError } = await supabase
      .from("rickhouse_pours")
      .select("id, is_used")
      .eq("game_id", gameId);

    if (poursError) {
      return NextResponse.json(
        { error: poursError.message },
        { status: 500 }
      );
    }

    const boardCleared =
      (pours || []).length > 0 &&
      (pours || []).every((pour) => pour.is_used);

    const roundEndsAt = game.round_ends_at
      ? new Date(game.round_ends_at).getTime()
      : null;

    const roundTimeExpired =
      roundEndsAt !== null && Date.now() >= roundEndsAt;

    const roundComplete =
      boardCleared ||
      roundTimeExpired ||
      Boolean(game.round_complete_reason);

    let proposedNextPickerPlayerId = null;

    if (roundComplete && game.round_name === "single_cask") {
      const { data: scores, error: scoresError } = await supabase
        .from("rickhouse_scores")
        .select("player_id, score")
        .eq("game_id", gameId)
        .order("score", { ascending: true });

      if (scoresError) {
        return NextResponse.json(
          { error: scoresError.message },
          { status: 500 }
        );
      }

      proposedNextPickerPlayerId =
        scores && scores.length > 0
          ? scores[0].player_id
          : null;
    }

    const nextPhase = roundComplete
      ? "round_intermission"
      : "board";

    const completionReason = boardCleared
      ? "board_cleared"
      : roundTimeExpired ||
        game.round_complete_reason === "time_expired"
      ? "time_expired"
      : game.round_complete_reason;

    const { data: updatedGame, error: updateError } =
      await supabase
        .from("rickhouse_games")
        .update({
          current_pour_id: null,
          game_phase: nextPhase,
          angels_share_player_id: null,
          angels_share_wager: null,
          angels_share_result: null,
          last_pour_result: null,
          round_complete_reason: roundComplete
            ? completionReason
            : null,
          proposed_next_picker_player_id: roundComplete
            ? proposedNextPickerPlayerId
            : null,
        })
        .eq("id", gameId)
        .select("*")
        .single();

    if (updateError || !updatedGame) {
      return NextResponse.json(
        {
          error:
            updateError?.message ||
            "Could not continue Rickhouse.",
        },
        { status: 500 }
      );
    }

    await supabase
      .from("sessions")
      .update({
        current_question_id: null,
        current_question_text: null,
        current_category: null,
        current_subcategory: null,
        current_difficulty: null,
        current_answer: null,
        current_answer_aliases: null,
        question_started_at: null,
        question_ends_at: null,
        question_status: roundComplete
          ? "round_intermission"
          : "closed",
        show_answer: false,
        game_mode: "rickhouse",
      })
      .eq("id", game.session_id);

    return NextResponse.json({
      game: updatedGame,
      roundComplete,
      boardCleared,
      roundTimeExpired,
      proposedNextPickerPlayerId,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Unknown error." },
      { status: 500 }
    );
  }
}