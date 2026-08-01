import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const sessionId = body.sessionId;

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId is required." },
        { status: 400 }
      );
    }

    const { data: lastCall } = await supabase.from("last_call_games").select("phase").eq("session_id", sessionId).maybeSingle();
    if (!lastCall || lastCall.phase !== "complete") {
      return NextResponse.json(
        { error: "Last Call must be completed before the session can end." },
        { status: 400 }
      );
    }

    const { data: session, error } = await supabase
      .from("sessions")
      .update({
        status: "ended",
        question_status: "closed",
        game_mode: "complete",
        current_question_id: null,
        current_question_text: null,
        current_category: null,
        current_subcategory: null,
        current_difficulty: null,
        current_answer: null,
        current_answer_aliases: null,
        question_started_at: null,
        question_ends_at: null,
        show_answer: false,
      })
      .eq("id", sessionId)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ session });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Unknown error." },
      { status: 500 }
    );
  }
}
