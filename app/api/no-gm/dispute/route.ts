import { NextResponse } from "next/server";
import { requireAnonymousPlayer } from "@/lib/noGmAuth";

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireAnonymousPlayer(request); const body = await request.json();
    const { sessionId, action } = body;
    const { data: player } = await supabase.from("players").select("id").eq("session_id", sessionId).eq("auth_user_id", user.id).single();
    if (!player) return NextResponse.json({ error: "Player not found." }, { status: 404 });
    if (action === "open") {
      const { data: session } = await supabase.from("sessions").select("current_question_id,question_status").eq("id", sessionId).single();
      if (!session?.current_question_id || session.question_status !== "revealed") return NextResponse.json({ error: "Disputes open after the answer is revealed." }, { status: 403 });
      const { data: answer } = await supabase.from("answers").select("id,is_correct").eq("session_id", sessionId).eq("player_id", player.id).eq("question_id", session.current_question_id).maybeSingle();
      if (!answer || answer.is_correct) return NextResponse.json({ error: "Only an uncounted answer can be disputed." }, { status: 403 });
      const { error } = await supabase.from("answer_disputes").insert({ session_id: sessionId, answer_id: answer.id, player_id: player.id, closes_at: new Date(Date.now() + 30000).toISOString() });
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }
    if (action === "vote") {
      const { data: dispute } = await supabase.from("answer_disputes").select("id,closes_at,status").eq("id", body.disputeId).eq("session_id", sessionId).single();
      if (!dispute || dispute.status !== "open" || Date.now() > new Date(dispute.closes_at).getTime()) return NextResponse.json({ error: "Voting has closed." }, { status: 403 });
      const { error } = await supabase.from("answer_dispute_votes").upsert({ dispute_id: dispute.id, player_id: player.id, vote_yes: body.voteYes === true, voted_at: new Date().toISOString() }, { onConflict: "dispute_id,player_id" });
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Unknown dispute action." }, { status: 400 });
  } catch (error: any) { return NextResponse.json({ error: error.message || "Could not handle dispute." }, { status: 500 }); }
}
