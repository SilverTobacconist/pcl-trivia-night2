import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionId, questionId, answerIds } = body;

    if (!sessionId || !questionId) {
      return NextResponse.json(
        { error: "sessionId and questionId are required." },
        { status: 400 }
      );
    }

    const selectedIds = new Set<string>(
      Array.isArray(answerIds) ? answerIds.map(String) : []
    );

    const { data: answers, error: answersError } = await supabase
      .from("answers")
      .select("id, player_id, is_correct")
      .eq("session_id", sessionId)
      .eq("question_id", questionId);

    if (answersError) {
      return NextResponse.json(
        { error: "Could not load answers.", details: answersError.message },
        { status: 500 }
      );
    }

    let gradedCount = 0;
    let alreadyGradedCount = 0;

    for (const answer of answers ?? []) {
      if (answer.is_correct !== null) {
        alreadyGradedCount++;
        continue;
      }

      const isCorrect = selectedIds.has(String(answer.id));

      // Only update an answer that is still ungraded. This prevents a second
      // grading request from awarding the same point again.
      const { data: updatedAnswer, error: updateAnswerError } = await supabase
        .from("answers")
        .update({
          is_correct: isCorrect,
          points_awarded: isCorrect ? 1 : 0,
        })
        .eq("id", answer.id)
        .is("is_correct", null)
        .select("id")
        .maybeSingle();

      if (updateAnswerError) {
        return NextResponse.json(
          {
            error: "Could not save the grading result.",
            details: updateAnswerError.message,
          },
          { status: 500 }
        );
      }

      // Another request may have graded it between the initial SELECT and the
      // guarded UPDATE. In that case, do not award points again.
      if (!updatedAnswer) {
        alreadyGradedCount++;
        continue;
      }

      if (isCorrect) {
        const { data: player, error: playerLoadError } = await supabase
          .from("players")
          .select("score")
          .eq("id", answer.player_id)
          .single();

        if (playerLoadError) {
          return NextResponse.json(
            {
              error: "The answer was graded, but the player score could not be loaded.",
              details: playerLoadError.message,
            },
            { status: 500 }
          );
        }

        const { error: playerUpdateError } = await supabase
          .from("players")
          .update({ score: (player?.score ?? 0) + 1 })
          .eq("id", answer.player_id);

        if (playerUpdateError) {
          return NextResponse.json(
            {
              error: "The answer was graded, but the player score could not be updated.",
              details: playerUpdateError.message,
            },
            { status: 500 }
          );
        }
      }

      gradedCount++;
    }

    const { error: sessionUpdateError } = await supabase
      .from("sessions")
      .update({ question_status: "graded" })
      .eq("id", sessionId);

    if (sessionUpdateError) {
      return NextResponse.json(
        {
          error: "Answers were graded, but the session status could not be updated.",
          details: sessionUpdateError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      graded: gradedCount,
      alreadyGraded: alreadyGradedCount,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}