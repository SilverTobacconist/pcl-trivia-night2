import { NextResponse } from "next/server";
import { requireAnonymousPlayer } from "@/lib/noGmAuth";
import { POST as startRickhouse } from "@/app/api/rickhouse/start/route";
import { POST as selectPour } from "@/app/api/rickhouse/select-pour/route";
import { POST as submitWager } from "@/app/api/rickhouse/submit-wager/route";
import { POST as submitAnswer } from "@/app/api/rickhouse/submit-answer/route";
import { POST as submitCaskWager } from "@/app/api/rickhouse/cask-strength/submit-wager/route";
import { POST as submitCaskAnswer } from "@/app/api/rickhouse/cask-strength/submit-answer/route";

function forwarded(body: any) { return new Request("http://internal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); }

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireAnonymousPlayer(request);
    const { sessionId, action, value } = await request.json();
    const [{ data: player }, { data: control }, { data: game }] = await Promise.all([
      supabase.from("players").select("id,left_at").eq("session_id", sessionId).eq("auth_user_id", user.id).single(),
      supabase.from("session_controls").select("*").eq("session_id", sessionId).single(),
      supabase.from("rickhouse_games").select("*").eq("session_id", sessionId).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (!player || player.left_at || !control) return NextResponse.json({ error: "Game player not found." }, { status: 404 });
    if (action === "start") {
      if (control.decision_player_id !== player.id) return NextResponse.json({ error: "Only the Decision Player starts a mode." }, { status: 403 });
      const response = await startRickhouse(forwarded({ sessionId, roundName: "single_cask", pickerPlayerId: player.id }));
      if (response.ok) await supabase.from("session_controls").update({ state: "main_active", last_activity_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("session_id", sessionId);
      return response;
    }
    if (!game) return NextResponse.json({ error: "Rickhouse is not active." }, { status: 404 });
    if (action === "pick") {
      if (game.current_picker_player_id !== player.id) return NextResponse.json({ error: "It is not your pick." }, { status: 403 });
      return selectPour(forwarded({ gameId: game.id, pourId: value, playerId: player.id }));
    }
    if (action === "wager") return submitWager(forwarded({ gameId: game.id, playerId: player.id, wagerAmount: value }));
    if (action === "answer") {
      const { data: pour } = await supabase.from("rickhouse_pours").select("question_id").eq("id", game.current_pour_id).single();
      return submitAnswer(forwarded({ sessionId, playerId: player.id, questionId: pour?.question_id, submittedAnswer: String(value || "").trim() }));
    }
    if (action === "cask_wager") return submitCaskWager(forwarded({ gameId: game.id, playerId: player.id, wager: value }));
    if (action === "cask_answer") return submitCaskAnswer(forwarded({ gameId: game.id, playerId: player.id, answer: String(value || "").trim() }));
    return NextResponse.json({ error: "Unknown Rickhouse action." }, { status: 400 });
  } catch (error: any) { return NextResponse.json({ error: error.message || "Could not update Rickhouse." }, { status: 500 }); }
}
