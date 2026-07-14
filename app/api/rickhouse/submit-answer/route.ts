import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const sessionId = body.sessionId;
    const playerId = body.playerId;
    const questionId = body.questionId;
    const submittedAnswer = body.submittedAnswer;

    if (!sessionId || !playerId || !questionId || !submittedAnswer) {
      return NextResponse.json(
        {
          error:
            "sessionId, playerId, questionId, and submittedAnswer are required.",
        },
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

    if (!game.current_pour_id) {
      return NextResponse.json(
        { error: "No active Rickhouse pour found." },
        { status: 400 }
      );
    }

    const { data: pour, error: pourError } = await supabase
      .from("rickhouse_pours")
      .select("*")
      .eq("id", game.current_pour_id)
      .eq("game_id", game.id)
      .single();

    if (pourError || !pour) {
      return NextResponse.json(
        { error: "Rickhouse pour not found." },
        { status: 404 }
      );
    }

    if (pour.question_id !== questionId) {
      return NextResponse.json(
        { error: "Submitted question does not match active Rickhouse pour." },
        { status: 400 }
      );
    }

    if (pour.selected_at) {
      const now = new Date();
      const selectedAt = new Date(pour.selected_at);
      const responseTimeMs = now.getTime() - selectedAt.getTime();

      const { data: existingAnswer } = await supabase
        .from("rickhouse_answers")
        .select("*")
        .eq("pour_id", pour.id)
        .eq("player_id", playerId)
        .maybeSingle();

      if (existingAnswer) {
        return NextResponse.json(
          { error: "You already submitted an answer for this pour." },
          { status: 400 }
        );
      }

      const { data: answer, error: answerError } = await supabase
        .from("rickhouse_answers")
        .insert({
          game_id: game.id,
          pour_id: pour.id,
          session_id: sessionId,
          player_id: playerId,
          submitted_answer: submittedAnswer,
          response_time_ms: responseTimeMs,
        })
        .select("*")
        .single();

      if (answerError) {
        return NextResponse.json(
          { error: answerError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({ answer });
    }

    return NextResponse.json(
      { error: "Rickhouse pour has no selected_at time." },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Unknown error." },
      { status: 500 }
    );
  }
}