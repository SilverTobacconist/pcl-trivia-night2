import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionCode = searchParams.get("sessionCode");

  if (!sessionCode) {
    return NextResponse.json(
      { error: "sessionCode is required." },
      { status: 400 }
    );
  }

  const { data: session, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("session_code", sessionCode)
.single();

  if (error || !session) {
    return NextResponse.json(
      { error: "No session found with that code." },
      { status: 404 }
    );
  }

  const { data: control } = await supabase.from("session_controls").select("decision_player_id,state").eq("session_id", session.id).order("updated_at", { ascending: false }).limit(1).maybeSingle();
  return NextResponse.json({ session, needsController: !control, isPaused: control?.state === "timeout" });
}
