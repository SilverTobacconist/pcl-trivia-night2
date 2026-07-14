import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const gameId = searchParams.get("gameId");

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

  if (!game.current_pour_id) {
    return NextResponse.json({ answers: [], pour: null });
  }

  const { data: pour, error: pourError } = await supabase
  .from("rickhouse_pours")
  .select("*")
  .eq("id", game.current_pour_id)
  .single();

if (pourError || !pour) {
  return NextResponse.json(
    { error: "Active Rickhouse pour not found." },
    { status: 404 }
  );
}

  const { data: answers, error: answersError } = await supabase
    .from("rickhouse_answers")
    .select("*")
    .eq("game_id", gameId)
    .eq("pour_id", game.current_pour_id)
    .order("response_time_ms", { ascending: true });

  if (answersError) {
    return NextResponse.json(
      { error: answersError.message },
      { status: 500 }
    );
  }

  const playerIds = [...new Set((answers || []).map((answer) => answer.player_id))];

  const { data: players } = await supabase
    .from("players")
    .select("id, display_name")
    .in("id", playerIds.length > 0 ? playerIds : ["00000000-0000-0000-0000-000000000000"]);

    function normalize(value: string) {
        return value
          .toLowerCase()
          .trim()
          .replace(/[^\w\s]/g, "")
          .replace(/\s+/g, " ");
      }
      
      const correctAnswers = [
        pour.correct_answer,
        ...(pour.answer_aliases || "")
          .split("|")
          .map((alias: string) => alias.trim())
          .filter(Boolean),
      ].map(normalize);
      
      const answersWithPlayers = (answers || []).map((answer) => {
        const player = players?.find((player) => player.id === answer.player_id);
        const submitted = normalize(answer.submitted_answer || "");
      
        return {
          ...answer,
          player_name: player?.display_name ?? "Unknown",
          auto_is_correct: correctAnswers.includes(submitted),
        };
      });

  return NextResponse.json({
    pour,
    answers: answersWithPlayers,
  });
}