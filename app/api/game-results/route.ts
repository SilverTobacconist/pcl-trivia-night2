import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get("sessionId");
  if (!sessionId) return NextResponse.json({ error: "sessionId is required." }, { status: 400 });

  const { data, error } = await supabase
    .from("session_game_results")
    .select("game_type,game_number,placements,completed_at")
    .eq("session_id", sessionId)
    .order("completed_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ games: data || [] }, { headers: { "Cache-Control": "no-store" } });
}
