import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { recordGameResult } from "@/lib/gameResults";

function placementPoints(place: number) {
  if (place === 1) return 10;
  if (place === 2) return 8;
  if (place === 3) return 6;
  if (place === 4) return 4;
  return 1;
}

export async function POST(request: Request) {
  try {
    const { gameId } = await request.json();

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
        { error: gameError?.message || "Game not found." },
        { status: 404 }
      );
    }

    const { data: entries, error: entriesError } = await supabase
      .from("rickhouse_cask_strength_entries")
      .select("*")
      .eq("game_id", gameId)
      .order("final_score", { ascending: false });

    if (entriesError) {
      return NextResponse.json(
        { error: entriesError.message },
        { status: 500 }
      );
    }

    if (!entries || entries.length === 0) {
      return NextResponse.json(
        { error: "No Cask Strength entries were found." },
        { status: 400 }
      );
    }

    let index = 0;

    while (index < entries.length) {
      const scoreAtPosition = Number(entries[index].final_score ?? 0);
      const tiedEntries = entries.filter(
        (entry) => Number(entry.final_score ?? 0) === scoreAtPosition
      );
      const startPlace = index + 1;
      const pointPool = tiedEntries.reduce(
        (sum, _entry, offset) => sum + placementPoints(startPlace + offset),
        0
      );
      // A player who finishes Rickhouse at zero has no session-placement
      // award, even if every other finalist was eliminated first.
      const pointsAwarded =
        scoreAtPosition <= 0
          ? 0
          : Math.ceil(pointPool / tiedEntries.length);

      for (const entry of tiedEntries) {
        if (entry.session_points_awarded !== null) continue;
        const { error: entryUpdateError } = await supabase
          .from("rickhouse_cask_strength_entries")
          .update({ session_points_awarded: pointsAwarded })
          .eq("id", entry.id);

        if (entryUpdateError) {
          return NextResponse.json(
            {
              error: "Could not record awarded session points.",
              details: entryUpdateError.message,
            },
            { status: 500 }
          );
        }

        const { data: player, error: playerReadError } = await supabase
          .from("players")
          .select("score")
          .eq("id", entry.player_id)
          .single();

        if (playerReadError || !player) {
          return NextResponse.json(
            {
              error: "Could not load a player before awarding session points.",
              details: playerReadError?.message,
            },
            { status: 500 }
          );
        }

        const { error: playerUpdateError } = await supabase
          .from("players")
          .update({ score: Number(player.score || 0) + pointsAwarded })
          .eq("id", entry.player_id);

        if (playerUpdateError) {
          return NextResponse.json(
            {
              error: "Could not award session points to a player.",
              details: playerUpdateError.message,
            },
            { status: 500 }
          );
        }
      }

      index += tiedEntries.length;
    }

    const { data: allScores } = await supabase.from("rickhouse_scores").select("player_id,score").eq("game_id", game.id);
    const rankedScores = (allScores || []).map((score) => ({
      player_id: score.player_id,
      game_score: Number(entries.find((entry) => entry.player_id === score.player_id)?.final_score ?? score.score ?? 0),
    })).sort((a, b) => b.game_score - a.game_score);
    const allPlayerIds = rankedScores.map((entry) => entry.player_id);
    const { data: names } = await supabase.from("players").select("id,display_name").in("id", allPlayerIds.length ? allPlayerIds : ["00000000-0000-0000-0000-000000000000"]);
    await recordGameResult(game.session_id, game.id, "rickhouse", rankedScores.map((entry, entryIndex, all) => ({
      player_id: entry.player_id,
      player_name: names?.find((player) => player.id === entry.player_id)?.display_name || "Unknown",
      place: all.findIndex((candidate) => candidate.game_score === entry.game_score) + 1,
      game_score: entry.game_score,
    })));

    const { error: gameUpdateError } = await supabase
      .from("rickhouse_games")
      .update({
        game_phase: "cask_strength_complete",
        status: "active",
      })
      .eq("id", gameId);

    if (gameUpdateError) {
      return NextResponse.json(
        {
          error: "Session points were awarded, but Rickhouse could not be closed.",
          details: gameUpdateError.message,
        },
        { status: 500 }
      );
    }

    const { error: sessionUpdateError } = await supabase
      .from("sessions")
      .update({
        game_mode: "rickhouse",
        question_status: "rickhouse_complete",
        current_question_id: null,
        current_question_text: null,
        current_answer: null,
        current_answer_aliases: null,
        current_category: null,
        current_subcategory: null,
        question_started_at: null,
        question_ends_at: null,
        question_duration_seconds: null,
        show_answer: false,
      })
      .eq("id", game.session_id);

    if (sessionUpdateError) {
      return NextResponse.json(
        {
          error: "Rickhouse ended, but the session could not return to main trivia.",
          details: sessionUpdateError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Unknown error." },
      { status: 500 }
    );
  }
}
