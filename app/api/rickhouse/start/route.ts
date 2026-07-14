import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

const QUESTIONS_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSpLt8hHXfb9tNryhHh6w7Z7GZ-evzFcpZZ512sdYNKKW_dnQ-LDgwI9jGLhJAOPQ/pub?gid=802549699&single=true&output=csv";

function parseCsvLine(line: string) {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"' && nextChar === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

function parseCsv(csv: string) {
  const lines = csv.trim().split(/\r?\n/);
  const headers = parseCsvLine(lines[0]);

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });

    return row;
  });
}

async function getQuestions() {
  const response = await fetch(QUESTIONS_CSV_URL, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Could not load questions from Google Sheets.");
  }

  const csv = await response.text();

  return parseCsv(csv).filter(
    (question) => question.active?.toLowerCase() !== "false"
  );
}

function shuffle<T>(items: T[]) {
  const shuffled = [...items];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const randomIndex = Math.floor(Math.random() * (i + 1));

    [shuffled[i], shuffled[randomIndex]] = [
      shuffled[randomIndex],
      shuffled[i],
    ];
  }

  return shuffled;
}

function difficultyForRow(roundName: string, rowIndex: number) {
  if (roundName === "double_cask") {
    if (rowIndex === 0) return "Easy";
    if (rowIndex <= 2) return "Medium";
    if (rowIndex === 3) return "Hard";
    return "Extra Hard";
  }

  if (rowIndex <= 1) return "Easy";
  if (rowIndex <= 3) return "Medium";

  return "Hard";
}

function pointValueForRow(roundName: string, rowIndex: number) {
  const singleCaskValues = [200, 400, 600, 800, 1000];
  const doubleCaskValues = [400, 800, 1200, 1600, 2000];

  return roundName === "double_cask"
    ? doubleCaskValues[rowIndex]
    : singleCaskValues[rowIndex];
}

function difficultyRank(value: string) {
  const ranks: Record<string, number> = {
    Easy: 1,
    Medium: 2,
    Hard: 3,
    "Extra Hard": 4,
  };

  return ranks[value] ?? 0;
}

function chooseQuestion(
  availableQuestions: any[],
  targetDifficulty: string
) {
  if (availableQuestions.length === 0) return null;

  const exactMatches = availableQuestions.filter(
    (question) => question.difficulty === targetDifficulty
  );

  if (exactMatches.length > 0) {
    return shuffle(exactMatches)[0];
  }

  return [...availableQuestions].sort((a, b) => {
    const aDifference = Math.abs(
      difficultyRank(a.difficulty) - difficultyRank(targetDifficulty)
    );

    const bDifference = Math.abs(
      difficultyRank(b.difficulty) - difficultyRank(targetDifficulty)
    );

    return aDifference - bDifference;
  })[0];
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const sessionId = body.sessionId;
    const roundName = body.roundName || "single_cask";
    const requestedPickerPlayerId = body.pickerPlayerId || null;

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId is required." },
        { status: 400 }
      );
    }

    if (!["single_cask", "double_cask"].includes(roundName)) {
      return NextResponse.json(
        { error: "Invalid Rickhouse round name." },
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
      .select("id, display_name")
      .eq("session_id", sessionId);

    if (playersError) {
      return NextResponse.json(
        { error: playersError.message },
        { status: 500 }
      );
    }

    if (!players || players.length === 0) {
      return NextResponse.json(
        { error: "At least one player must join before Rickhouse begins." },
        { status: 400 }
      );
    }

    let previousGame: any = null;
    let previousScores: any[] = [];

    if (roundName === "double_cask") {
      const { data: priorGame, error: priorGameError } = await supabase
        .from("rickhouse_games")
        .select("*")
        .eq("session_id", sessionId)
        .eq("round_name", "single_cask")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (priorGameError || !priorGame) {
        return NextResponse.json(
          { error: "Single Cask must be completed before Double Cask begins." },
          { status: 400 }
        );
      }

      if (priorGame.game_phase !== "round_intermission") {
        return NextResponse.json(
          { error: "Single Cask is not ready to advance to Double Cask." },
          { status: 400 }
        );
      }

      previousGame = priorGame;

      const { data: priorScores, error: priorScoresError } = await supabase
        .from("rickhouse_scores")
        .select("player_id, score")
        .eq("game_id", priorGame.id);

      if (priorScoresError) {
        return NextResponse.json(
          { error: priorScoresError.message },
          { status: 500 }
        );
      }

      previousScores = priorScores || [];
    }

    const requestedPickerIsValid = requestedPickerPlayerId
      ? players.some((player) => player.id === requestedPickerPlayerId)
      : false;

    const startingPickerPlayerId = requestedPickerIsValid
      ? requestedPickerPlayerId
      : players[Math.floor(Math.random() * players.length)].id;

    const questions = await getQuestions();

    const eligibleQuestions = questions.filter((question: any) => {
      if (!question.question_id || !question.question_text) {
        return false;
      }

      if (session.location === "Hastings") {
        return question.hastings_used?.toLowerCase() !== "true";
      }

      if (session.location === "Norfolk") {
        return question.norfolk_used?.toLowerCase() !== "true";
      }

      return true;
    });

    const categoryGroups: Record<string, any[]> = {};

    eligibleQuestions.forEach((question: any) => {
      const categoryKey = question.subcategory || question.category;

      if (!categoryKey) return;

      if (!categoryGroups[categoryKey]) {
        categoryGroups[categoryKey] = [];
      }

      categoryGroups[categoryKey].push(question);
    });

    const usableCategories = Object.entries(categoryGroups)
      .filter(([, groupedQuestions]) => groupedQuestions.length >= 5)
      .map(([categoryName, groupedQuestions]) => ({
        categoryName,
        questions: groupedQuestions,
      }));

    if (usableCategories.length < 5) {
      return NextResponse.json(
        {
          error:
            "Not enough categories or subcategories have five eligible questions.",
        },
        { status: 400 }
      );
    }

    const selectedCategories = shuffle(usableCategories).slice(0, 5);

    const roundStartedAt = new Date();
    const roundDurationSeconds = 15 * 60;
    const roundEndsAt = new Date(
      roundStartedAt.getTime() + roundDurationSeconds * 1000
    );

    const { data: game, error: gameError } = await supabase
      .from("rickhouse_games")
      .insert({
        session_id: sessionId,
        round_name: roundName,
        status: "active",
        game_phase: "board",
        current_picker_player_id: startingPickerPlayerId,
        current_pour_id: null,
        round_started_at: roundStartedAt.toISOString(),
        round_ends_at: roundEndsAt.toISOString(),
        round_duration_seconds: roundDurationSeconds,
        round_complete_reason: null,
        proposed_next_picker_player_id: null,
      })
      .select("*")
      .single();

    if (gameError || !game) {
      return NextResponse.json(
        {
          error:
            gameError?.message || "Could not create the Rickhouse game.",
        },
        { status: 500 }
      );
    }

    const angelCount = roundName === "double_cask" ? 2 : 1;
    const angelPositions = new Set<string>();

    while (angelPositions.size < angelCount) {
      const columnIndex = Math.floor(Math.random() * 5);
      const rowIndex = Math.floor(Math.random() * 5);

      angelPositions.add(`${columnIndex}-${rowIndex}`);
    }

    const pours: any[] = [];
    const selectedQuestionIds = new Set<string>();

    for (
      let columnIndex = 0;
      columnIndex < selectedCategories.length;
      columnIndex++
    ) {
      const selectedCategory = selectedCategories[columnIndex];

      for (let rowIndex = 0; rowIndex < 5; rowIndex++) {
        const targetDifficulty = difficultyForRow(roundName, rowIndex);

        const unusedCategoryQuestions =
          selectedCategory.questions.filter(
            (question: any) =>
              !selectedQuestionIds.has(question.question_id)
          );

        const question = chooseQuestion(
          unusedCategoryQuestions,
          targetDifficulty
        );

        if (!question) {
          return NextResponse.json(
            {
              error: `Could not fill every value in ${selectedCategory.categoryName}.`,
            },
            { status: 400 }
          );
        }

        selectedQuestionIds.add(question.question_id);

        pours.push({
          game_id: game.id,
          session_id: sessionId,
          round_name: roundName,
          category: selectedCategory.categoryName,
          subcategory: question.subcategory || "",
          column_index: columnIndex,
          row_index: rowIndex,
          point_value: pointValueForRow(roundName, rowIndex),
          question_id: question.question_id,
          question_text: question.question_text,
          correct_answer: question.answer,
          answer_aliases: question.answer_aliases || "",
          difficulty: question.difficulty,
          is_angels_share: angelPositions.has(
            `${columnIndex}-${rowIndex}`
          ),
          is_used: false,
          is_graded: false,
        });
      }
    }

    const { error: poursError } = await supabase
      .from("rickhouse_pours")
      .insert(pours);

    if (poursError) {
      return NextResponse.json(
        { error: poursError.message },
        { status: 500 }
      );
    }

    const scoreRows = players.map((player) => {
      const previousScore = previousScores.find(
        (score) => score.player_id === player.id
      );

      return {
        game_id: game.id,
        session_id: sessionId,
        player_id: player.id,
        score:
          roundName === "double_cask"
            ? previousScore?.score ?? 0
            : 0,
      };
    });

    const { error: scoreError } = await supabase
      .from("rickhouse_scores")
      .insert(scoreRows);

    if (scoreError) {
      return NextResponse.json(
        { error: scoreError.message },
        { status: 500 }
      );
    }

    if (previousGame) {
      const { error: previousGameUpdateError } = await supabase
        .from("rickhouse_games")
        .update({ status: "completed" })
        .eq("id", previousGame.id);

      if (previousGameUpdateError) {
        return NextResponse.json(
          { error: previousGameUpdateError.message },
          { status: 500 }
        );
      }
    }

    const { data: savedPours, error: savedPoursError } = await supabase
      .from("rickhouse_pours")
      .select("*")
      .eq("game_id", game.id)
      .order("column_index", { ascending: true })
      .order("row_index", { ascending: true });

    if (savedPoursError) {
      return NextResponse.json(
        { error: savedPoursError.message },
        { status: 500 }
      );
    }

    await supabase
      .from("sessions")
      .update({
        game_mode: "rickhouse",
        question_status: "closed",
        current_question_id: null,
        current_question_text: null,
        current_category: null,
        current_subcategory: null,
        current_difficulty: null,
        current_answer: null,
        current_answer_aliases: null,
        question_started_at: null,
        question_ends_at: null,
        show_answer: false,
      })
      .eq("id", sessionId);

    const { data: savedScores } = await supabase
      .from("rickhouse_scores")
      .select("*")
      .eq("game_id", game.id)
      .order("score", { ascending: false });

    return NextResponse.json({
      game,
      pours: savedPours,
      scores: savedScores || [],
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Unknown error." },
      { status: 500 }
    );
  }
}