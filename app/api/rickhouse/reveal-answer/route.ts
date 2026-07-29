import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function POST(request: Request) {
  try {
    const { gameId } = await request.json();
    if (!gameId) return NextResponse.json({ error: "gameId is required." }, { status: 400 });

    const { data: game, error } = await supabase.from("rickhouse_games").select("*").eq("id", gameId).single();
    if (error || !game) return NextResponse.json({ error: "Rickhouse game not found." }, { status: 404 });

    const nextPhase = game.game_phase === "angels_graded" ? "angels_reveal" : game.game_phase === "pour_graded" ? "pour_reveal" : null;
    if (!nextPhase) return NextResponse.json({ error: "This Rickhouse answer is not ready to reveal." }, { status: 400 });

    const { data: updatedGame, error: gameError } = await supabase.from("rickhouse_games").update({ game_phase: nextPhase }).eq("id", gameId).select("*").single();
    if (gameError) return NextResponse.json({ error: gameError.message }, { status: 500 });

    const { error: sessionError } = await supabase.from("sessions").update({ question_status: nextPhase, show_answer: true }).eq("id", game.session_id);
    if (sessionError) return NextResponse.json({ error: sessionError.message }, { status: 500 });

    return NextResponse.json({ game: updatedGame });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Unknown error." }, { status: 500 });
  }
}