import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const sessionId = String(body.sessionId ?? "").trim();
    const playerId = String(body.playerId ?? "").trim();
    const questionId = String(body.questionId ?? "").trim();
    const submittedAnswer = String(body.submittedAnswer ?? "").trim();

    if (!sessionId || !playerId || !questionId || !submittedAnswer) {
      return NextResponse.json(
        { error: "Missing required answer information." },
        { status: 400 }
      );
    }

    const { data: session, error: sessionError } = await supabase
  .from("sessions")
  .select("question_status, question_ends_at")
  .eq("id", sessionId)
  .single();

if (sessionError || !session) {
  return NextResponse.json(
    { error: "Session not found." },
    { status: 404 }
  );
}

if (session.question_status !== "active") {
  return NextResponse.json(
    { error: "This question is no longer accepting answers." },
    { status: 403 }
  );
}

if (session.question_ends_at) {
  const now = new Date();
  const endsAt = new Date(session.question_ends_at);

  if (now > endsAt) {
    await supabase
      .from("sessions")
      .update({
        question_status: "closed",
      })
      .eq("id", sessionId);

    return NextResponse.json(
      { error: "Time is up. This question is closed." },
      { status: 403 }
    );
  }
}

    const { data: existingAnswer } = await supabase
      .from("answers")
      .select("id")
      .eq("session_id", sessionId)
      .eq("player_id", playerId)
      .eq("question_id", questionId)
      .maybeSingle();

    if (existingAnswer) {
      return NextResponse.json(
        { error: "You already submitted an answer for this question." },
        { status: 409 }
      );
    }

    const { data: answer, error } = await supabase
      .from("answers")
      .insert({
        session_id: sessionId,
        player_id: playerId,
        question_id: questionId,
        submitted_answer: submittedAnswer,
        is_correct: null,
        points_awarded: 0,
        submitted_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        {
          error: "Could not submit answer.",
          details: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ answer });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message ?? "Unknown error." },
      { status: 500 }
    );
  }
}