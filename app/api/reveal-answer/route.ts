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

    const { data: session, error } = await supabase
      .from("sessions")
      .update({
        show_answer: true,
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