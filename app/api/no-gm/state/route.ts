import { NextResponse } from "next/server";
import { requestSupabase } from "@/lib/noGmAuth";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url); const sessionId = searchParams.get("sessionId");
  if (!sessionId) return NextResponse.json({ error: "sessionId is required." }, { status: 400 });
  const supabase = requestSupabase(request);
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  const { data: authData } = token ? await supabase.auth.getUser(token) : { data: { user: null } };
  const [{ data: session }, { data: control }, { data: players }, { data: disputes }, { data: leaderboardExport }, { data: currentPlayer }] = await Promise.all([
    supabase.from("sessions").select("*").eq("id", sessionId).single(),
    supabase.from("session_controls").select("*").eq("session_id", sessionId).maybeSingle(),
    supabase.from("players").select("id,display_name,score,left_at").eq("session_id", sessionId).order("score", { ascending: false }).order("display_name"),
    supabase.from("answer_disputes").select("*").eq("session_id", sessionId).eq("status", "open").maybeSingle(),
    supabase.from("session_leaderboard_exports").select("*").eq("session_id", sessionId).maybeSingle(),
    authData.user ? supabase.from("players").select("id").eq("session_id", sessionId).eq("auth_user_id", authData.user.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const { data: myAnswer } = currentPlayer && session?.current_question_id
    ? await supabase.from("answers").select("submitted_answer,is_correct,points_awarded").eq("session_id", sessionId).eq("player_id", currentPlayer.id).eq("question_id", session.current_question_id).maybeSingle()
    : { data: null };
  const { data: lastCallGame } = session?.game_mode === "last_call"
    ? await supabase.from("last_call_games").select("*").eq("session_id", sessionId).is("completed_at", null).maybeSingle()
    : { data: null };
  const { data: lastCallEntries } = lastCallGame
    ? await supabase.from("last_call_entries").select("*,players(display_name)").eq("game_id", lastCallGame.id).order("starting_score", { ascending: true })
    : { data: [] };
  const lastCallEntry = currentPlayer && lastCallGame
    ? (lastCallEntries || []).find((entry: any) => entry.player_id === currentPlayer.id) || null
    : null;
  const { data: agingGame } = session?.game_mode === "aging_room" ? await supabase.from("aging_room_games").select("*").eq("session_id", sessionId).in("status", ["active", "completed"]).maybeSingle() : { data: null };
  const { data: agingPlayers } = agingGame ? await supabase.from("aging_room_players").select("*").eq("game_id", agingGame.id).order("final_place", { ascending: true, nullsFirst: true }) : { data: [] };
  const { data: agingEntry } = agingGame && currentPlayer ? await supabase.from("aging_room_answers").select("*").eq("game_id", agingGame.id).eq("player_id", currentPlayer.id).eq("question_number", agingGame.question_number).eq("attempt_number", agingGame.attempt_number).maybeSingle() : { data: null };
  const { data: rickhouseGame } = session?.game_mode === "rickhouse" ? await supabase.from("rickhouse_games").select("*").eq("session_id", sessionId).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle() : { data: null };
  const { data: rickhousePours } = rickhouseGame ? await supabase.from("rickhouse_pours").select("*").eq("game_id", rickhouseGame.id).order("column_index").order("row_index") : { data: [] };
  const { data: rickhouseScores } = rickhouseGame ? await supabase.from("rickhouse_scores").select("*").eq("game_id", rickhouseGame.id).order("score", { ascending: false }) : { data: [] };
  const rickhousePlayerIds = (rickhouseScores || []).map((row: any) => row.player_id);
  const { data: rickhouseNames } = rickhousePlayerIds.length ? await supabase.from("players").select("id,display_name").in("id", rickhousePlayerIds) : { data: [] };
  const activePour = rickhouseGame?.current_pour_id ? (rickhousePours || []).find((pour: any) => pour.id === rickhouseGame.current_pour_id) || null : null;
  const { data: rickhouseAnswer } = rickhouseGame && currentPlayer && activePour ? await supabase.from("rickhouse_answers").select("*").eq("pour_id", activePour.id).eq("player_id", currentPlayer.id).maybeSingle() : { data: null };
  const { data: caskEntries } = rickhouseGame?.game_phase?.startsWith("cask_strength") ? await supabase.from("rickhouse_cask_strength_entries").select("*").eq("game_id", rickhouseGame.id).order("reveal_order") : { data: [] };
  const standings = (rickhouseScores || []).map((row: any) => ({ ...row, player_name: (rickhouseNames || []).find((p: any) => p.id === row.player_id)?.display_name || "Unknown" }));
  const rickhouse = rickhouseGame ? { game: rickhouseGame, pours: rickhousePours || [], standings, activePour, myAnswer: rickhouseAnswer || null, myScore: (rickhouseScores || []).find((row: any) => row.player_id === currentPlayer?.id)?.score || 0, caskEntries: caskEntries || [], myCaskEntry: (caskEntries || []).find((entry: any) => entry.player_id === currentPlayer?.id) || null } : null;
  return NextResponse.json({ session, control, players: players || [], dispute: disputes || null, leaderboardExport: leaderboardExport || null, myAnswer: myAnswer || null, lastCall: lastCallGame ? { game: lastCallGame, entries: lastCallEntries || [], entry: lastCallEntry } : null, aging: agingGame ? { game: agingGame, players: agingPlayers || [], entry: agingEntry || null } : null, rickhouse }, { headers: { "Cache-Control": "no-store" } });
}
