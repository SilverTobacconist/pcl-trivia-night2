import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

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

    const { error: gameUpdateError } = await supabase
      .from("rickhouse_games")
      .update({
        game_phase: "cask_strength_complete",
        status: "complete",
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
        game_mode: "main",
        question_status: "closed",
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
