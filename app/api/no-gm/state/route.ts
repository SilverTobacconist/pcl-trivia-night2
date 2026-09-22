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
    supabase.from("players").select("id,display_name,score").eq("session_id", sessionId).order("score", { ascending: false }).order("display_name"),
    supabase.from("answer_disputes").select("*").eq("session_id", sessionId).eq("status", "open").maybeSingle(),
    supabase.from("session_leaderboard_exports").select("*").eq("session_id", sessionId).maybeSingle(),
    authData.user ? supabase.from("players").select("id").eq("session_id", sessionId).eq("auth_user_id", authData.user.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const { data: myAnswer } = currentPlayer && session?.current_question_id
    ? await supabase.from("answers").select("submitted_answer,is_correct,points_awarded").eq("session_id", sessionId).eq("player_id", currentPlayer.id).eq("question_id", session.current_question_id).maybeSingle()
    : { data: null };
  return NextResponse.json({ session, control, players: players || [], dispute: disputes || null, leaderboardExport: leaderboardExport || null, myAnswer: myAnswer || null }, { headers: { "Cache-Control": "no-store" } });
}
