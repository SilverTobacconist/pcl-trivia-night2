import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const gameId = body.gameId;
    const correctAnswerIds = body.correctAnswerIds ?? [];

    if (!gameId) {
      return NextResponse.json({ error: "gameId is required." }, { status: 400 });
    }

    const { data: game, error: gameError } = await supabase
      .from("rickhouse_games")
      .select("*")
      .eq("id", gameId)
      .single();

    if (gameError || !game) {
      return NextResponse.json({ error: "Rickhouse game not found." }, { status: 404 });
    }

    const { data: pour, error: pourError } = await supabase
      .from("rickhouse_pours")
      .select("*")
      .eq("id", game.current_pour_id)
      .single();

    if (pourError || !pour) {
      return NextResponse.json({ error: "Pour not found." }, { status: 404 });
    }

    if (pour.is_graded) {
      return NextResponse.json(
        { error: "This pour has already been graded." },
        { status: 400 }
      );
    }

    const { data: answers, error: answersError } = await supabase
      .from("rickhouse_answers")
      .select("*")
      .eq("game_id", gameId)
      .eq("pour_id", game.current_pour_id)
      .order("response_time_ms", { ascending: true });

    if (answersError) {
      return NextResponse.json({ error: answersError.message }, { status: 500 });
    }

    const isAngelsShare = game.game_phase === "angels_question";
    const pointValue = isAngelsShare
      ? Number(game.angels_share_wager || 0)
      : Number(pour.point_value || 0);

    let nextPickerPlayerId =
      typeof game.current_picker_player_id === "string"
        ? game.current_picker_player_id
        : game.current_picker_player_id?.id ?? null;

    const fastestCorrectAnswer =
      answers?.find((answer) => correctAnswerIds.includes(answer.id)) ?? null;

    for (const answer of answers || []) {
      const isCorrect = correctAnswerIds.includes(answer.id);
      const pointsAwarded = isCorrect ? pointValue : -pointValue;

      await supabase
        .from("rickhouse_answers")
        .update({
          is_correct: isCorrect,
          points_awarded: pointsAwarded,
        })
        .eq("id", answer.id);

      const { data: existingScore } = await supabase
        .from("rickhouse_scores")
        .select("*")
        .eq("game_id", gameId)
        .eq("player_id", answer.player_id)
        .maybeSingle();

      if (existingScore) {
        await supabase
          .from("rickhouse_scores")
          .update({ score: existingScore.score + pointsAwarded })
          .eq("id", existingScore.id);
      } else {
        await supabase.from("rickhouse_scores").insert({
          game_id: gameId,
          session_id: game.session_id,
          player_id: answer.player_id,
          score: pointsAwarded,
        });
      }
    }

    if (!isAngelsShare && fastestCorrectAnswer) {
      nextPickerPlayerId = fastestCorrectAnswer.player_id;
    }

    const angelsShareAnswer = isAngelsShare
      ? answers?.find((answer) => answer.player_id === game.angels_share_player_id)
      : null;

    const angelsShareWasCorrect = angelsShareAnswer
      ? correctAnswerIds.includes(angelsShareAnswer.id)
      : false;

    if (isAngelsShare && !angelsShareAnswer && game.angels_share_player_id) {
      const { data: existingScore } = await supabase
        .from("rickhouse_scores")
        .select("*")
        .eq("game_id", gameId)
        .eq("player_id", game.angels_share_player_id)
        .maybeSingle();

      if (existingScore) {
        await supabase
          .from("rickhouse_scores")
          .update({ score: existingScore.score - pointValue })
          .eq("id", existingScore.id);
      } else {
        await supabase.from("rickhouse_scores").insert({
          game_id: gameId,
          session_id: game.session_id,
          player_id: game.angels_share_player_id,
          score: -pointValue,
        });
      }
    }

    await supabase
      .from("rickhouse_pours")
      .update({ is_graded: true })
      .eq("id", pour.id);

    await supabase
      .from("rickhouse_games")
      .update({
        current_picker_player_id: nextPickerPlayerId,
        current_pour_id: game.current_pour_id,
        game_phase: isAngelsShare ? "angels_reveal" : "pour_reveal",
        angels_share_result: isAngelsShare
          ? JSON.stringify({
              answer: angelsShareAnswer?.submitted_answer ?? "No answer",
              isCorrect: angelsShareWasCorrect,
              pointsAwarded: angelsShareWasCorrect ? pointValue : -pointValue,
            })
          : null,
        last_pour_result: !isAngelsShare
          ? JSON.stringify({
              correctAnswer: pour.correct_answer,
              pointValue: pour.point_value,
              nextPickerPlayerId,
              fastestCorrectPlayerId: fastestCorrectAnswer?.player_id ?? null,
            })
          : null,
      })
      .eq("id", gameId);

    await supabase
      .from("sessions")
      .update({
        question_status: isAngelsShare ? "angels_reveal" : "pour_reveal",
        game_mode: "rickhouse",
      })
      .eq("id", game.session_id);

    return NextResponse.json({
      success: true,
      nextPickerPlayerId,
      graded: answers?.length ?? 0,
      gamePhase: isAngelsShare ? "angels_reveal" : "pour_reveal",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Unknown error." },
      { status: 500 }
    );
  }
}