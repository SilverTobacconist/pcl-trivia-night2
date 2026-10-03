import { NextResponse } from "next/server";
import { requireAnonymousPlayer } from "@/lib/noGmAuth";
import { POST as startRickhouse } from "@/app/api/rickhouse/start/route";
import { POST as selectPour } from "@/app/api/rickhouse/select-pour/route";
import { POST as submitWager } from "@/app/api/rickhouse/submit-wager/route";
import { POST as submitAnswer } from "@/app/api/rickhouse/submit-answer/route";
import { POST as submitCaskWager } from "@/app/api/rickhouse/cask-strength/submit-wager/route";
import { POST as submitCaskAnswer } from "@/app/api/rickhouse/cask-strength/submit-answer/route";
import { POST as revealCask } from "@/app/api/rickhouse/cask-strength/reveal-next/route";
import { POST as finalizeCask } from "@/app/api/rickhouse/cask-strength/finalize/route";
import { POST as closeRickhouse } from "@/app/api/rickhouse/close/route";

function forwarded(body: any) { return new Request("http://internal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); }

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireAnonymousPlayer(request);
    const { sessionId, action, value } = await request.json();
    const [{ data: player }, { data: control }, { data: game }, { data: session }] = await Promise.all([
      supabase.from("players").select("id,left_at").eq("session_id", sessionId).eq("auth_user_id", user.id).single(),
      supabase.from("session_controls").select("*").eq("session_id", sessionId).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("rickhouse_games").select("*").eq("session_id", sessionId).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("sessions").select("trivia_tuesday_event_id,trivia_tuesday_phase").eq("id", sessionId).single(),
    ]);
    if (!player || player.left_at || !control) return NextResponse.json({ error: "Game player not found." }, { status: 404 });
    if (action === "start") {
      if (session?.trivia_tuesday_phase === "countdown") return NextResponse.json({ error:"Trivia Tuesday starts shortly.  No new modes can begin until its Rickhouse is complete." },{status:409});
      if (control.decision_player_id !== player.id) return NextResponse.json({ error: "Only the Decision Player starts a mode." }, { status: 403 });
      const response = await startRickhouse(forwarded({ sessionId, roundName: "single_cask", pickerPlayerId: player.id, triviaTuesdayEventId: session?.trivia_tuesday_phase === "seasonal" ? session.trivia_tuesday_event_id : null }));
      if (response.ok) await supabase.from("session_controls").update({ state: "main_active", last_activity_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("session_id", sessionId);
      return response;
    }
    if (!game) return NextResponse.json({ error: "Rickhouse is not active." }, { status: 404 });
    if (action === "return_to_main") {
      if (control.decision_player_id !== player.id) return NextResponse.json({ error: "Only the Decision Player can return to ordinary trivia." }, { status: 403 });
      if (!["cask_strength_complete","cask_strength_session_leaderboard"].includes(game.game_phase)) return NextResponse.json({ error: "Rickhouse must be complete before returning to ordinary trivia." }, { status: 409 });
      return closeRickhouse(forwarded({ gameId: game.id }));
    }
    if (action === "pick") {
      if (session?.trivia_tuesday_phase === "countdown") return NextResponse.json({ error:"Trivia Tuesday starts shortly.  No additional Rickhouse questions can begin." },{status:409});
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
    if (action === "cask_reveal_next") {
      if (control.decision_player_id !== player.id || game.game_phase !== "cask_strength_reveal") return NextResponse.json({ error:"Only the Decision Player may advance the final reveal." },{status:403});
      return revealCask(forwarded({ gameId: game.id }));
    }
    if (action === "cask_finalize") {
      if (control.decision_player_id !== player.id || game.game_phase !== "cask_strength_final_leaderboard") return NextResponse.json({ error:"Reveal the final leaderboard before awarding session points." },{status:409});
      return finalizeCask(forwarded({ gameId: game.id }));
    }
    if (action === "cask_show_session_leaderboard") {
      if (control.decision_player_id !== player.id || game.game_phase !== "cask_strength_complete") return NextResponse.json({ error:"Award the game-session points first." },{status:409});
      await supabase.from("rickhouse_games").update({ game_phase:"cask_strength_session_leaderboard" }).eq("id",game.id);
      return NextResponse.json({ ok:true });
    }
    return NextResponse.json({ error: "Unknown Rickhouse action." }, { status: 400 });
  } catch (error: any) { return NextResponse.json({ error: error.message || "Could not update Rickhouse." }, { status: 500 }); }
}
