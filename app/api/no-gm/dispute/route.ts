import { NextResponse } from "next/server";
import { requireAnonymousPlayer } from "@/lib/noGmAuth";

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireAnonymousPlayer(request); const body = await request.json();
    const { sessionId, action } = body;
    const { data: player } = await supabase.from("players").select("id").eq("session_id", sessionId).eq("auth_user_id", user.id).single();
    if (!player) return NextResponse.json({ error: "Player not found." }, { status: 404 });
    if (action === "open") {
      const { data: session } = await supabase.from("sessions").select("*").eq("id", sessionId).single();
      if (!session) return NextResponse.json({ error:"Game not found." },{status:404});
      let sourceType="main", sourceId:string|undefined, answerId:string|undefined, questionText=session.current_question_text, correctAnswer=session.current_answer, submittedAnswer="";
      if (["main","keyword_trivia"].includes(session.game_mode)) {
        if (session.question_status !== "revealed") return NextResponse.json({ error:"Disputes open after the answer is revealed." },{status:403});
        const { data: answer } = await supabase.from("answers").select("id,is_correct,submitted_answer").eq("session_id",sessionId).eq("player_id",player.id).eq("question_id",session.current_question_id).maybeSingle();
        if (!answer || answer.is_correct) return NextResponse.json({ error:"Only an uncounted answer can be disputed." },{status:403});
        sourceId=answer.id; answerId=answer.id; submittedAnswer=answer.submitted_answer;
      } else if (session.game_mode === "rickhouse") {
        const { data: game } = await supabase.from("rickhouse_games").select("*").eq("session_id",sessionId).eq("status","active").order("created_at",{ascending:false}).limit(1).maybeSingle();
        if (!game) return NextResponse.json({ error:"Rickhouse is not active." },{status:404});
        if (["pour_reveal","angels_reveal"].includes(game.game_phase)) {
          const { data: pour } = await supabase.from("rickhouse_pours").select("*").eq("id",game.current_pour_id).single(); const { data: answer } = await supabase.from("rickhouse_answers").select("id,is_correct,submitted_answer").eq("pour_id",game.current_pour_id).eq("player_id",player.id).maybeSingle();
          if (!pour || !answer || answer.is_correct) return NextResponse.json({ error:"Only an uncounted answer can be disputed." },{status:403});
          sourceType="rickhouse"; sourceId=answer.id; submittedAnswer=answer.submitted_answer; questionText=pour.question_text; correctAnswer=pour.correct_answer;
        } else if (game.game_phase === "cask_strength_reveal") {
          const { data: entry } = await supabase.from("rickhouse_cask_strength_entries").select("id,is_correct,submitted_answer").eq("game_id",game.id).eq("player_id",player.id).maybeSingle();
          if (!entry || entry.is_correct) return NextResponse.json({ error:"Only an uncounted answer can be disputed." },{status:403});
          sourceType="cask_strength"; sourceId=entry.id; submittedAnswer=entry.submitted_answer || ""; questionText=game.cask_strength_question_text; correctAnswer=game.cask_strength_correct_answer;
        } else return NextResponse.json({ error:"Disputes open after the answer is revealed." },{status:403});
      } else if (session.game_mode === "aging_room") {
        const { data: game }=await supabase.from("aging_room_games").select("*").eq("session_id",sessionId).eq("status","active").maybeSingle();
        if (!game || !["question_result","bale_result"].includes(game.phase)) return NextResponse.json({error:"Disputes open after the answer is revealed."},{status:403});
        const { data:answer }=await supabase.from("aging_room_answers").select("id,is_correct,submitted_answer").eq("game_id",game.id).eq("player_id",player.id).eq("question_number",game.question_number).eq("attempt_number",game.attempt_number).maybeSingle();
        if(!answer || answer.is_correct) return NextResponse.json({error:"Only an uncounted answer can be disputed."},{status:403});
        sourceType="aging_room"; sourceId=answer.id; submittedAnswer=answer.submitted_answer; questionText=game.question_text; correctAnswer=game.correct_answer;
      } else return NextResponse.json({ error:"This mode has no revealed answer to dispute." },{status:403});
      const { error } = await supabase.from("answer_disputes").insert({ session_id:sessionId,answer_id:answerId || null,source_type:sourceType,source_id:sourceId,question_text:questionText,correct_answer:correctAnswer,submitted_answer:submittedAnswer,player_id:player.id,closes_at:new Date(Date.now()+30000).toISOString() });
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
