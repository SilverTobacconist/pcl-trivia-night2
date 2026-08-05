import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { recordGameResult } from "@/lib/gameResults";

function placementPoints(place: number) {
  return place === 1 ? 10 : place === 2 ? 8 : place === 3 ? 6 : place === 4 ? 4 : 1;
}

export async function POST(request: Request) {
  try {
    const { gameId, early = false } = await request.json();
    if (!gameId) return NextResponse.json({ error: "gameId is required." }, { status: 400 });

    const { data: game } = await supabase.from("rickhouse_games").select("*").eq("id", gameId).single();
    if (!game) return NextResponse.json({ error: "Rickhouse game not found." }, { status: 404 });

    const completedNormally = game.game_phase === "cask_strength_complete";
    if (!completedNormally && !early) {
      return NextResponse.json({ error: "Rickhouse Trivia is not ready to close." }, { status: 409 });
    }

    if (!completedNormally) {
      const { data: existingResult } = await supabase
        .from("session_game_results")
        .select("id")
        .eq("source_game_id", game.id)
        .maybeSingle();

      if (!existingResult) {
        const { data: scores } = await supabase
          .from("rickhouse_scores")
          .select("player_id,score")
          .eq("game_id", game.id)
          .order("score", { ascending: false });
        const ranked = scores || [];
        const ids = ranked.map((row) => row.player_id);
        const { data: players } = await supabase
          .from("players")
          .select("id,display_name,score")
          .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);

        let index = 0;
        while (index < ranked.length) {
          const value = Number(ranked[index].score || 0);
          const tied = ranked.filter((row) => Number(row.score || 0) === value);
          const pool = tied.reduce((sum, _row, offset) => sum + placementPoints(index + offset + 1), 0);
          const award = value > 0 ? Math.ceil(pool / tied.length / 2) : 0;
          for (const row of tied) {
            const player = players?.find((item) => item.id === row.player_id);
            if (player && award > 0) {
              await supabase.from("players").update({ score: Number(player.score || 0) + award }).eq("id", player.id);
            }
          }
          index += tied.length;
        }

        await recordGameResult(game.session_id, game.id, "rickhouse", ranked.map((row, rowIndex, all) => ({
          player_id: row.player_id,
          player_name: players?.find((player) => player.id === row.player_id)?.display_name || "Unknown",
          place: all.findIndex((candidate) => Number(candidate.score) === Number(row.score)) + 1,
          game_score: Number(row.score || 0),
        })));
      }
    }

    await supabase.from("rickhouse_games").update({
      status: "completed",
      game_phase: completedNormally ? game.game_phase : "ended_early",
    }).eq("id", gameId);
    await supabase.from("sessions").update({
      game_mode: "main", question_status: "closed", current_question_id: null,
      current_question_text: null, current_answer: null, current_answer_aliases: null,
      current_category: null, current_subcategory: null, current_difficulty: null,
      question_started_at: null, question_ends_at: null, question_duration_seconds: null,
      show_answer: false,
    }).eq("id", game.session_id);
    return NextResponse.json({ success: true, endedEarly: !completedNormally });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Could not return to main trivia." }, { status: 500 });
  }
}
