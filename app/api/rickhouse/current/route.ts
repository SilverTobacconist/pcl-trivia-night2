import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId is required." },
        { status: 400 }
      );
    }

    const { data: game, error: gameError } = await supabase
      .from("rickhouse_games")
      .select("*")
      .eq("session_id", sessionId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (gameError || !game) {
      return NextResponse.json(
        { error: "No active Rickhouse game found." },
        { status: 404 }
      );
    }

    const { data: pours, error: poursError } = await supabase
      .from("rickhouse_pours")
      .select("*")
      .eq("game_id", game.id)
      .order("column_index", { ascending: true })
      .order("row_index", { ascending: true });

    if (poursError) {
      return NextResponse.json(
        { error: poursError.message },
        { status: 500 }
      );
    }

    const { data: scoreRows, error: scoresError } = await supabase
      .from("rickhouse_scores")
      .select("*")
      .eq("game_id", game.id)
      .order("score", { ascending: false });

    if (scoresError) {
      return NextResponse.json(
        { error: scoresError.message },
        { status: 500 }
      );
    }

    const playerIds = [
      ...new Set((scoreRows || []).map((score) => score.player_id)),
    ];

    const { data: players } = await supabase
      .from("players")
      .select("id, display_name")
      .in(
        "id",
        playerIds.length > 0
          ? playerIds
          : ["00000000-0000-0000-0000-000000000000"]
      );

    const standings = (scoreRows || []).map((score) => {
      const player = players?.find(
        (item) => item.id === score.player_id
      );

      return {
        ...score,
        player_name: player?.display_name ?? "Unknown",
      };
    });

    const unusedPours = (pours || []).filter((pour) => !pour.is_used);
    const boardCleared = unusedPours.length === 0;

    const roundEndsAt = game.round_ends_at
      ? new Date(game.round_ends_at).getTime()
      : null;

    const roundSecondsRemaining = roundEndsAt
      ? Math.max(0, Math.ceil((roundEndsAt - Date.now()) / 1000))
      : null;

    const roundTimeExpired =
      roundSecondsRemaining !== null && roundSecondsRemaining <= 0;

    let currentGame = game;

    if (
      roundTimeExpired &&
      !game.round_complete_reason
    ) {
      const { data: updatedGame } = await supabase
        .from("rickhouse_games")
        .update({
          round_complete_reason: "time_expired",
        })
        .eq("id", game.id)
        .select("*")
        .single();

      if (updatedGame) {
        currentGame = updatedGame;
      }
    }

    const shouldEnterIntermission =
      currentGame.game_phase === "board" &&
      (boardCleared ||
        currentGame.round_complete_reason === "time_expired");

    if (shouldEnterIntermission) {
      const lowestScorePlayer =
        currentGame.round_name === "single_cask" && standings.length > 0
          ? [...standings].sort((a, b) => {
              if (a.score !== b.score) {
                return a.score - b.score;
              }

              return String(a.player_name).localeCompare(
                String(b.player_name)
              );
            })[0]
          : null;

      const completionReason = boardCleared
        ? "board_cleared"
        : "time_expired";

      const { data: intermissionGame, error: updateError } =
        await supabase
          .from("rickhouse_games")
          .update({
            game_phase: "round_intermission",
            round_complete_reason: completionReason,
            proposed_next_picker_player_id:
              lowestScorePlayer?.player_id ?? null,
            current_pour_id: null,
          })
          .eq("id", game.id)
          .select("*")
          .single();

      if (updateError) {
        return NextResponse.json(
          { error: updateError.message },
          { status: 500 }
        );
      }

      currentGame = intermissionGame;
    }

    let picker = null;

    if (currentGame.current_picker_player_id) {
      const { data: pickerData } = await supabase
        .from("players")
        .select("id, display_name")
        .eq("id", currentGame.current_picker_player_id)
        .maybeSingle();

      picker = pickerData;
    }

    let proposedNextPicker = null;

    if (currentGame.proposed_next_picker_player_id) {
      const { data: proposedPickerData } = await supabase
        .from("players")
        .select("id, display_name")
        .eq(
          "id",
          currentGame.proposed_next_picker_player_id
        )
        .maybeSingle();

      proposedNextPicker = proposedPickerData;
    }

    // Cask Strength timers advance automatically when time expires.  A short
    // grace period gives player devices time to auto-submit what is currently
    // typed before the server fills missing wagers/answers.
    if (["cask_strength_wager", "cask_strength_question"].includes(currentGame.game_phase)) {
      const endsAt = currentGame.cask_strength_ends_at
        ? new Date(currentGame.cask_strength_ends_at).getTime()
        : 0;
      if (endsAt && Date.now() >= endsAt + 2000) {
        const { data: entries } = await supabase
          .from("rickhouse_cask_strength_entries")
          .select("*")
          .eq("game_id", currentGame.id);

        if (currentGame.game_phase === "cask_strength_wager") {
          for (const entry of entries || []) {
            if (entry.wager === null) {
              await supabase.from("rickhouse_cask_strength_entries").update({ wager: 0 }).eq("id", entry.id);
            }
          }
          const startedAt = new Date();
          const questionEndsAt = new Date(startedAt.getTime() + 30000);
          const { data: advanced } = await supabase.from("rickhouse_games").update({
            game_phase: "cask_strength_question",
            cask_strength_started_at: startedAt.toISOString(),
            cask_strength_ends_at: questionEndsAt.toISOString(),
          }).eq("id", currentGame.id).select("*").single();
          await supabase.from("sessions").update({
            current_question_id: currentGame.cask_strength_question_id,
            current_question_text: currentGame.cask_strength_question_text,
            current_subcategory: currentGame.cask_strength_subcategory,
            current_answer: currentGame.cask_strength_correct_answer,
            current_answer_aliases: currentGame.cask_strength_answer_aliases,
            question_status: "active",
            question_started_at: startedAt.toISOString(),
            question_ends_at: questionEndsAt.toISOString(),
            question_duration_seconds: 30,
            show_answer: false,
          }).eq("id", currentGame.session_id);
          if (advanced) currentGame = advanced;
        } else {
          for (const entry of entries || []) {
            if (entry.submitted_answer === null) {
              await supabase.from("rickhouse_cask_strength_entries").update({ submitted_answer: "" }).eq("id", entry.id);
            }
          }
          const { data: gradingGame } = await supabase.from("rickhouse_games").update({
            game_phase: "cask_strength_grading",
          }).eq("id", currentGame.id).select("*").single();
          await supabase.from("sessions").update({ question_status: "grading" }).eq("id", currentGame.session_id);
          if (gradingGame) currentGame = gradingGame;
        }
      }
    }

    const { data: caskStrengthEntries } = await supabase
      .from("rickhouse_cask_strength_entries")
      .select("*")
      .eq("game_id", currentGame.id)
      .order("reveal_order", { ascending: true });

    const caskPlayerIds = (caskStrengthEntries || []).map((entry) => entry.player_id);
    const { data: caskPlayers } = await supabase.from("players").select("id, display_name").in(
      "id",
      caskPlayerIds.length ? caskPlayerIds : ["00000000-0000-0000-0000-000000000000"]
    );
    const caskStrength = (caskStrengthEntries || []).map((entry) => ({
      ...entry,
      player_name: caskPlayers?.find((player) => player.id === entry.player_id)?.display_name || "Unknown",
    }));

    const activePour = currentGame.current_pour_id
      ? pours?.find(
          (pour) => pour.id === currentGame.current_pour_id
        ) ?? null
      : null;

    return NextResponse.json({
      game: currentGame,
      pours,
      picker,
      proposedNextPicker,
      activePour,
      standings,
      boardCleared,
      unusedPourCount: unusedPours.length,
      roundSecondsRemaining,
      roundTimeExpired,
      caskStrength,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Unknown error." },
      { status: 500 }
    );
  }
}