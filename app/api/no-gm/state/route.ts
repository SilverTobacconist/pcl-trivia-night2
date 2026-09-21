import { NextResponse } from "next/server";
import { requestSupabase } from "@/lib/noGmAuth";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url); const sessionId = searchParams.get("sessionId");
  if (!sessionId) return NextResponse.json({ error: "sessionId is required." }, { status: 400 });
  const supabase = requestSupabase(request);
  const [{ data: session }, { data: control }, { data: players }, { data: disputes }, { data: leaderboardExport }] = await Promise.all([
    supabase.from("sessions").select("*").eq("id", sessionId).single(),
    supabase.from("session_controls").select("*").eq("session_id", sessionId).maybeSingle(),
    supabase.from("players").select("id,display_name,score").eq("session_id", sessionId).order("score", { ascending: false }).order("display_name"),
    supabase.from("answer_disputes").select("*").eq("session_id", sessionId).eq("status", "open").maybeSingle(),
    supabase.from("session_leaderboard_exports").select("*").eq("session_id", sessionId).maybeSingle(),
  ]);
  return NextResponse.json({ session, control, players: players || [], dispute: disputes || null, leaderboardExport: leaderboardExport || null }, { headers: { "Cache-Control": "no-store" } });
}
