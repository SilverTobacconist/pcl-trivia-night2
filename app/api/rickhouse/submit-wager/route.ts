import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const gameId = body.gameId;
    const playerId = body.playerId;
    const wagerAmount = Number(body.wagerAmount);

    if (!gameId || !playerId || Number.isNaN(wagerAmount)) {
      return NextResponse.json(
        { error: "gameId, playerId, and wagerAmount are required." },
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

    if (game.game_phase !== "angels_wager") {
      return NextResponse.json(
        { error: "This game is not waiting for an Angel's Share wager." },
        { status: 400 }
      );
    }

    if (game.angels_share_player_id !== playerId) {
      return NextResponse.json(
        { error: "Only the Angel's Share player may wager." },
        { status: 403 }
      );
    }

    const { data: scoreRow } = await supabase
      .from("rickhouse_scores")
      .select("score")
      .eq("game_id", gameId)
      .eq("player_id", playerId)
      .maybeSingle();

    const currentScore = scoreRow?.score ?? 0;
    const minimumWagerLimit =
      game.round_name === "double_cask" ? 2000 : 1000;
    const maxWager = Math.max(currentScore, minimumWagerLimit);

    if (wagerAmount < 0 || wagerAmount > maxWager) {
      return NextResponse.json(
        { error: `Wager must be between 0 and ${maxWager}.` },
        { status: 400 }
      );
    }

    const { data: pour, error: pourError } = await supabase
      .from("rickhouse_pours")
      .select("*")
      .eq("id", game.current_pour_id)
      .single();

    if (pourError || !pour) {
      return NextResponse.json(
        { error: "Angel's Share pour not found." },
        { status: 404 }
      );
    }

    const startedAt = new Date();
    const durationSeconds = 30;
    const endsAt = new Date(startedAt.getTime() + durationSeconds * 1000);

    await supabase
      .from("rickhouse_games")
      .update({
        angels_share_wager: wagerAmount,
        game_phase: "angels_question",
      })
      .eq("id", gameId);

    const { data: updatedSession, error: sessionError } = await supabase
      .from("sessions")
      .update({
        current_question_id: pour.question_id,
        current_question_text: pour.question_text,
        current_category: pour.category,
        current_subcategory: pour.subcategory,
        current_difficulty: pour.difficulty,
        current_answer: pour.correct_answer,
        current_answer_aliases: pour.answer_aliases,
        question_started_at: startedAt.toISOString(),
        question_ends_at: endsAt.toISOString(),
        question_duration_seconds: durationSeconds,
        question_status: "active",
        show_answer: false,
        game_mode: "rickhouse",
      })
      .eq("id", game.session_id)
      .select("*")
      .single();

    if (sessionError || !updatedSession) {
      return NextResponse.json(
        { error: sessionError?.message || "Could not update session." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      session: updatedSession,
      wagerAmount,
      maxWager,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Unknown error." },
      { status: 500 }
    );
  }
}