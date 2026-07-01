import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const sessionId = searchParams.get("sessionId");
  const questionId = searchParams.get("questionId");

  if (!sessionId || !questionId) {
    return NextResponse.json(
      { error: "sessionId and questionId are required." },
      { status: 400 }
    );
  }

  const { data: answers, error: answersError } = await supabase
    .from("answers")
    .select("id, player_id, submitted_answer, submitted_at")
    .eq("session_id", sessionId)
    .eq("question_id", questionId)
    .order("submitted_at", { ascending: true });

  if (answersError) {
    return NextResponse.json(
      { error: answersError.message },
      { status: 500 }
    );
  }

  const playerIds = answers.map((answer) => answer.player_id);

  const { data: players, error: playersError } = await supabase
    .from("players")
    .select("id, display_name")
    .in("id", playerIds);

  if (playersError) {
    return NextResponse.json(
      { error: playersError.message },
      { status: 500 }
    );
  }

  const answersWithPlayers = answers.map((answer) => {
    const player = players.find(
      (player) => player.id === answer.player_id
    );

    return {
      ...answer,
      player_name: player?.display_name ?? "Unknown",
    };
  });

  return NextResponse.json({
    answers: answersWithPlayers,
  });
}