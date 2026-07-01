import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const sessionCode = String(body.sessionCode ?? "").trim();
    const displayName = String(body.displayName ?? "").trim();

    if (!sessionCode || !displayName) {
      return NextResponse.json(
        { error: "Session code and display name are required." },
        { status: 400 }
      );
    }

    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("id, session_code, location, status")
      .eq("session_code", sessionCode)
      .eq("status", "active")
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: "No active session found with that code." },
        { status: 404 }
      );
    }

    const { data: existingPlayer } = await supabase
      .from("players")
      .select("id")
      .eq("session_id", session.id)
      .ilike("display_name", displayName)
      .maybeSingle();

    if (existingPlayer) {
      return NextResponse.json(
        { error: "That display name is already taken for this session." },
        { status: 409 }
      );
    }

    const { data: player, error: playerError } = await supabase
      .from("players")
      .insert([
        {
          session_id: session.id,
          display_name: displayName,
          score: 0,
        },
      ])
      .select("id, session_id, display_name, score")
      .single();

    if (playerError) {
      return NextResponse.json(
        { error: playerError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      session,
      player,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}