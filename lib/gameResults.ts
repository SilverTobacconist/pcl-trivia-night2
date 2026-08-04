import { supabase } from "@/lib/supabaseClient";

export type GamePlacement = {
  player_id: string;
  player_name: string;
  place: number;
  game_score?: number;
};

export async function recordGameResult(
  sessionId: string,
  sourceGameId: string,
  gameType: "rickhouse" | "aging_room",
  placements: GamePlacement[]
) {
  const { data: existing } = await supabase
    .from("session_game_results")
    .select("id")
    .eq("source_game_id", sourceGameId)
    .maybeSingle();

  if (existing) return;

  const { count } = await supabase
    .from("session_game_results")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId)
    .eq("game_type", gameType);

  const { error } = await supabase.from("session_game_results").insert({
    session_id: sessionId,
    source_game_id: sourceGameId,
    game_type: gameType,
    game_number: Number(count || 0) + 1,
    placements,
  });

  if (error && error.code !== "23505") throw error;
}
