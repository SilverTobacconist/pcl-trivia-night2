import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");
  const playerId = searchParams.get("playerId");

  if (!sessionId || !playerId) {
    return NextResponse.json(
      { error: "sessionId and playerId are required." },
      { status: 400 }
    );
  }

  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (sessionError || !session) {
    return NextResponse.json(
      { error: "Session not found." },
      { status: 404 }
    );
  }

  const { data: player, error: playerError } = await supabase
    .from("players")
    .select("id, display_name, score, session_id")
    .eq("id", playerId)
    .eq("session_id", sessionId)
    .single();

  if (playerError || !player) {
    return NextResponse.json(
      { error: "Player not found for this session." },
      { status: 404 }
    );
  }

  return NextResponse.json({ session, player });
}