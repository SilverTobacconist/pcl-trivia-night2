import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function POST(request: Request) {
  try {
    const { gameId } = await request.json();
    if (!gameId) return NextResponse.json({ error: "gameId is required." }, { status: 400 });
    const { data: game } = await supabase.from("rickhouse_games").select("*").eq("id", gameId).single();
    if (!game || game.game_phase !== "cask_strength_complete") return NextResponse.json({ error: "Rickhouse Trivia is not ready to close." }, { status: 409 });
    await supabase.from("rickhouse_games").update({ status: "completed" }).eq("id", gameId);
    await supabase.from("sessions").update({
      game_mode: "main", question_status: "closed", current_question_id: null,
      current_question_text: null, current_answer: null, current_answer_aliases: null,
      current_category: null, current_subcategory: null, current_difficulty: null,
      question_started_at: null, question_ends_at: null, question_duration_seconds: null,
      show_answer: false,
    }).eq("id", game.session_id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Could not return to main trivia." }, { status: 500 });
  }
}
