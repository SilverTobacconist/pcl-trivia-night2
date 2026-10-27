import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requestSupabase } from "@/lib/noGmAuth";

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
  const requestClient = requestSupabase(request);
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: authData } = token ? await requestClient.auth.getUser(token) : { data: { user: null } };
  const { data: existingPlayer } = authData.user
    ? await requestClient.from("players").select("id,session_id,display_name,score,left_at").eq("session_id",session.id).eq("auth_user_id",authData.user.id).maybeSingle()
    : { data: null };
  const { data: triviaTuesday } = session.trivia_tuesday_event_id ? await getSupabaseAdmin().from("trivia_tuesday_events").select("event_name,scheduled_start_at,board_theme").eq("id", session.trivia_tuesday_event_id).maybeSingle() : { data: null };
  return NextResponse.json({ session, needsController: !control, isPaused: control?.state === "timeout", triviaTuesday, existingPlayer });
}
