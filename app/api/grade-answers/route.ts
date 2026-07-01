import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      sessionId,
      questionId,
      answerIds,
    } = body;

    if (!sessionId || !questionId) {
      return NextResponse.json(
        {
          error: "sessionId and questionId are required.",
        },
        { status: 400 }
      );
    }

    const selectedIds = answerIds ?? [];

    const { data: answers, error } = await supabase
      .from("answers")
      .select("*")
      .eq("session_id", sessionId)
      .eq("question_id", questionId);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    let gradedCount = 0;

    for (const answer of answers) {
      const isCorrect =
        selectedIds.includes(answer.id);

      if (answer.is_correct !== null) {
        continue;
      }

      await supabase
        .from("answers")
        .update({
          is_correct: isCorrect,
          points_awarded: isCorrect ? 1 : 0,
        })
        .eq("id", answer.id);

      if (isCorrect) {
        const { data: player } = await supabase
          .from("players")
          .select("score")
          .eq("id", answer.player_id)
          .single();

        await supabase
          .from("players")
          .update({
            score: (player?.score ?? 0) + 1,
          })
          .eq("id", answer.player_id);
      }

      gradedCount++;
    }

    await supabase
  .from("sessions")
  .update({
    question_status: "graded",
  })
  .eq("id", sessionId);

return NextResponse.json({
  success: true,
  graded: gradedCount,
});
  } catch (error: any) {
    return NextResponse.json(
      {
        error:
          error.message ??
          "Unknown error",
      },
      { status: 500 }
    );
  }
}