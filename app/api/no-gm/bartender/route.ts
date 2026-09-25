import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

async function endSession(sessionId: string) {
  const { data: leaderboard } = await supabase.from("players").select("id,display_name,score").eq("session_id", sessionId).order("score", { ascending: false });
  await supabase.from("session_leaderboard_exports").upsert({ session_id: sessionId, reason: "bartender_ended", leaderboard: leaderboard || [] }, { onConflict: "session_id" });
  await supabase.from("session_controls").update({ state: "ended", ended_at: new Date().toISOString(), exported_at: new Date().toISOString() }).eq("session_id", sessionId);
  await supabase.from("sessions").update({ status: "ended", game_mode: "complete", question_status: "closed", show_answer: false }).eq("id", sessionId);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const location = searchParams.get("location");
  if (!["Hastings", "Norfolk"].includes(String(location))) return NextResponse.json({ error: "Choose Hastings or Norfolk." }, { status: 400 });
  const { data: session, error } = await supabase.from("sessions").select("*").eq("location", location).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ session: session || null });
}

export async function POST(request: Request) {
  try {
    const { action, location, sessionId } = await request.json();
    if (!["Hastings", "Norfolk"].includes(location)) return NextResponse.json({ error: "Choose Hastings or Norfolk." }, { status: 400 });
    if (action === "reset_questions") { const { data: sessions } = await supabase.from("sessions").select("id").eq("location", location); const ids = (sessions || []).map((row: any) => row.id); if (ids.length) await supabase.from("question_history").delete().in("session_id", ids); return NextResponse.json({ ok: true, message: `${location} question history reset.` }); }
    if (action === "end_current") { if (!sessionId) return NextResponse.json({ error: "Start or reopen a game first." }, { status: 400 }); await endSession(sessionId); return NextResponse.json({ ok: true, message: "Current game ended and saved." }); }
    if (action === "end_all") { const { data: active } = await supabase.from("sessions").select("id").eq("location", location).eq("status", "active"); for (const game of active || []) await endSession(game.id); return NextResponse.json({ ok: true, message: `${(active || []).length} active game(s) ended and saved.` }); }
    return NextResponse.json({ error: "Unknown bartender action." }, { status: 400 });
  } catch (error: any) { return NextResponse.json({ error: error.message || "Could not update games." }, { status: 500 }); }
}
