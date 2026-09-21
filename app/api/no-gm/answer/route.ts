import { NextResponse } from "next/server";
import { requireAnonymousPlayer } from "@/lib/noGmAuth";

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireAnonymousPlayer(request);
    const { sessionId, submittedAnswer } = await request.json();
    const answerText = String(submittedAnswer || "").trim();
    if (!sessionId || !answerText) return NextResponse.json({ error: "Enter an answer first." }, { status: 400 });
    const [{ data: player }, { data: session }] = await Promise.all([
      supabase.from("players").select("id").eq("session_id", sessionId).eq("auth_user_id", user.id).single(),
      supabase.from("sessions").select("current_question_id,question_status,question_ends_at,status").eq("id", sessionId).single(),
    ]);
    if (!player || !session || session.status !== "active") return NextResponse.json({ error: "Game not found." }, { status: 404 });
    if (session.question_status !== "active" || !session.current_question_id || (session.question_ends_at && Date.now() > new Date(session.question_ends_at).getTime())) return NextResponse.json({ error: "That question is closed." }, { status: 403 });
    const { data: old } = await supabase.from("answers").select("id").eq("session_id", sessionId).eq("player_id", player.id).eq("question_id", session.current_question_id).maybeSingle();
    if (old) return NextResponse.json({ error: "You already answered this question." }, { status: 409 });
    const { error } = await supabase.from("answers").insert({ session_id: sessionId, player_id: player.id, question_id: session.current_question_id, submitted_answer: answerText, is_correct: null, points_awarded: 0, submitted_at: new Date().toISOString() });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error: any) { return NextResponse.json({ error: error.message || "Could not submit your answer." }, { status: 500 }); }
}
