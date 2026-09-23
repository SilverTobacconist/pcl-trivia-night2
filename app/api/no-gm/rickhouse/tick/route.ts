import { NextResponse } from "next/server";
import { requireAnonymousPlayer } from "@/lib/noGmAuth";
import { POST as gradePour } from "@/app/api/rickhouse/grade/route";
import { POST as revealPour } from "@/app/api/rickhouse/reveal-answer/route";
import { POST as continueRickhouse } from "@/app/api/rickhouse/continue/route";
import { POST as startRickhouse } from "@/app/api/rickhouse/start/route";
import { POST as startCask } from "@/app/api/rickhouse/cask-strength/start/route";
import { POST as gradeCask } from "@/app/api/rickhouse/cask-strength/grade/route";
import { POST as revealCask } from "@/app/api/rickhouse/cask-strength/reveal-next/route";
import { POST as finalizeCask } from "@/app/api/rickhouse/cask-strength/finalize/route";
import { GET as currentRickhouse } from "@/app/api/rickhouse/current/route";

function forwarded(body: any) { return new Request("http://internal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); }
function normalize(value: string) { return value.trim().replace(/\s+/g, " ").toLowerCase(); }
function isCorrect(answer: string, pour: any) { const choices = [pour.correct_answer, ...(String(pour.answer_aliases || "").split("|") || [])].map(normalize); return choices.includes(normalize(answer)); }
const wait = async (supabase: any, sessionId: string, seconds = 5) => supabase.from("sessions").update({ question_ends_at: new Date(Date.now() + seconds * 1000).toISOString() }).eq("id", sessionId);

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireAnonymousPlayer(request); const { sessionId } = await request.json();
    const [{ data: player }, { data: control }, { data: game }, { data: session }] = await Promise.all([
      supabase.from("players").select("id").eq("session_id", sessionId).eq("auth_user_id", user.id).single(),
      supabase.from("session_controls").select("*").eq("session_id", sessionId).single(),
      supabase.from("rickhouse_games").select("*").eq("session_id", sessionId).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("sessions").select("*").eq("id", sessionId).single(),
    ]);
    if (!player || control?.decision_player_id !== player.id || !game || !session) return NextResponse.json({ ok: true });
    const expired = !session.question_ends_at || Date.now() >= new Date(session.question_ends_at).getTime();
    if (["question", "angels_question"].includes(game.game_phase) && expired) {
      const [{ data: pour }, { data: answers }] = await Promise.all([
        supabase.from("rickhouse_pours").select("*").eq("id", game.current_pour_id).single(),
        supabase.from("rickhouse_answers").select("id,submitted_answer").eq("game_id", game.id).eq("pour_id", game.current_pour_id).order("response_time_ms"),
      ]);
      const correct = (answers || []).filter((answer: any) => isCorrect(answer.submitted_answer, pour)).map((answer: any) => answer.id);
      await gradePour(forwarded({ gameId: game.id, correctAnswerIds: correct }));
      await revealPour(forwarded({ gameId: game.id }));
      await wait(supabase, sessionId);
      return NextResponse.json({ ok: true });
    }
    if (["pour_reveal", "angels_reveal"].includes(game.game_phase) && expired) return continueRickhouse(forwarded({ gameId: game.id }));
    if (game.game_phase === "round_intermission") {
      if (game.round_name === "single_cask") return startRickhouse(forwarded({ sessionId, roundName: "double_cask", pickerPlayerId: game.proposed_next_picker_player_id }));
      return startCask(forwarded({ gameId: game.id }));
    }
    if (game.game_phase.startsWith("cask_strength")) {
      const currentResponse = await currentRickhouse(new Request(`http://internal?sessionId=${sessionId}`));
      const current = await currentResponse.json(); const updated = current.game;
      if (updated?.game_phase === "cask_strength_grading") {
        const correct = (current.caskStrength || []).filter((entry: any) => normalize(entry.submitted_answer || "") === normalize(updated.cask_strength_correct_answer || "") || String(updated.cask_strength_answer_aliases || "").split("|").map(normalize).includes(normalize(entry.submitted_answer || ""))).map((entry: any) => entry.id);
        await gradeCask(forwarded({ gameId: updated.id, correctEntryIds: correct })); await wait(supabase, sessionId, 3); return NextResponse.json({ ok: true });
      }
      if (updated?.game_phase === "cask_strength_reveal" && expired) {
        const reveal = await revealCask(forwarded({ gameId: updated.id })); const data = await reveal.json();
        if (data.complete) return finalizeCask(forwarded({ gameId: updated.id }));
        await wait(supabase, sessionId, 3);
      }
    }
    return NextResponse.json({ ok: true });
  } catch (error: any) { return NextResponse.json({ error: error.message || "Could not advance Rickhouse." }, { status: 500 }); }
}
