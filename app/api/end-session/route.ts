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

    // End every active Rickhouse game tied to this session first.  This also
    // makes the operation safe to retry from the host page.
    const { error: rickhouseError } = await supabase
      .from("rickhouse_games")
      .update({ status: "completed" })
      .eq("session_id", sessionId)
      .eq("status", "active");

    if (rickhouseError) {
      return NextResponse.json(
        { error: rickhouseError.message },
        { status: 500 }
      );
    }

    const { data: session, error } = await supabase
      .from("sessions")
      .update({
        status: "ended",
        question_status: "closed",
        game_mode: "main",
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
