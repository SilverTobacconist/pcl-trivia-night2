import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");

  if (!sessionId) {
    return NextResponse.json(
      { error: "sessionId is required." },
      { status: 400 }
    );
  }

  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (sessionError || !session) {
    return NextResponse.json(
      { error: "Session not found." },
      { status: 404 }
    );
  }

  const { data: players, error: playersError } = await supabase
    .from("players")
    .select("id, display_name, score")
    .eq("session_id", sessionId)
    .order("score", { ascending: false })
    .order("display_name", { ascending: true });

  if (playersError) {
    return NextResponse.json(
      { error: playersError.message },
      { status: 500 }
    );
  }

  const { data: history, error: historyError } = await supabase
    .from("question_history")
    .select("*")
    .eq("session_id", sessionId)
    .order("date_used", { ascending: true });

  if (historyError) {
    return NextResponse.json(
      { error: historyError.message },
      { status: 500 }
    );
  }

  const { data: answers, error: answersError } = await supabase
    .from("answers")
    .select("id, question_id, player_id, submitted_answer, is_correct, points_awarded, submitted_at")
    .eq("session_id", sessionId)
    .order("submitted_at", { ascending: true });

  if (answersError) {
    return NextResponse.json(
      { error: answersError.message },
      { status: 500 }
    );
  }

  const answersWithPlayers = answers.map((answer) => {
    const player = players.find((player) => player.id === answer.player_id);
  
    return {
      ...answer,
      player_name: player?.display_name ?? "Unknown",
    };
  });
  
  return NextResponse.json({
    session,
    players,
    history,
    answers: answersWithPlayers,
  });
}