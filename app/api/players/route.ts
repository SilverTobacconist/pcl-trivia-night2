import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");

  if (!sessionId) {
    return NextResponse.json(
      { error: "sessionId is required." },
      { status: 400 }
    );
  }

  const { data: players, error } = await supabase
    .from("players")
    .select("id, display_name, score, joined_at")
    .eq("session_id", sessionId)
    .order("joined_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ players });
}