export async function usedQuestionIdsForLocation(supabase: any, location: string, gameModes?: string[]) {
  const { data: sessions, error: sessionError } = await supabase.from("sessions").select("id").eq("location", location);
  if (sessionError) throw sessionError;
  const sessionIds = (sessions || []).map((session: any) => session.id);
  if (!sessionIds.length) return new Set<string>();
  let query = supabase.from("question_history").select("question_id").in("session_id", sessionIds);
  if (gameModes?.length) query = query.in("game_mode", gameModes);
  const { data: used, error } = await query;
  if (error) throw error;
  return new Set((used || []).map((row: any) => row.question_id).filter(Boolean));
}
