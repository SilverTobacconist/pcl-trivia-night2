import { NextResponse } from "next/server";
import { requireAnonymousPlayer } from "@/lib/noGmAuth";

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireAnonymousPlayer(request);
    const { sessionId, action, value } = await request.json();
    const [{ data: player }, { data: game }] = await Promise.all([
      supabase.from("players").select("id,score").eq("session_id", sessionId).eq("auth_user_id", user.id).single(),
      supabase.from("last_call_games").select("id,phase").eq("session_id", sessionId).is("completed_at", null).maybeSingle(),
    ]);
    if (!player || !game) return NextResponse.json({ error: "Last Call is not available for this player." }, { status: 404 });
    if (action === "vote") {
      const difficulty = Number(value);
      if (![1, 2, 3, 4].includes(difficulty) || game.phase !== "voting") return NextResponse.json({ error: "Voting is closed." }, { status: 400 });
      const { error } = await supabase.from("last_call_entries").upsert({ game_id: game.id, session_id: sessionId, player_id: player.id, difficulty_vote: difficulty }, { onConflict: "game_id,player_id" });
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }
    if (action === "wager") {
      const wager = Number(value);
      if (!Number.isInteger(wager) || wager < 0 || game.phase !== "wagering") return NextResponse.json({ error: "Enter a whole-number wager." }, { status: 400 });
      const { data: entry } = await supabase.from("last_call_entries").select("starting_score").eq("game_id", game.id).eq("player_id", player.id).single();
      if (!entry || wager > Number(entry.starting_score || 0)) return NextResponse.json({ error: "Your wager cannot exceed your score." }, { status: 400 });
      const { error } = await supabase.from("last_call_entries").update({ wager }).eq("game_id", game.id).eq("player_id", player.id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }
    if (action === "answer") {
      const answer = String(value || "").trim();
      if (!answer || game.phase !== "question") return NextResponse.json({ error: "Answer entry is closed." }, { status: 400 });
      const { error } = await supabase.from("last_call_entries").update({ submitted_answer: answer }).eq("game_id", game.id).eq("player_id", player.id).is("submitted_answer", null);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Unknown Last Call action." }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Could not update Last Call." }, { status: 500 });
  }
}
