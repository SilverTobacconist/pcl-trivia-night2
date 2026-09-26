import { NextResponse } from "next/server";
import { requireAnonymousPlayer } from "@/lib/noGmAuth";

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireAnonymousPlayer(request);
    const { sessionCode, displayName, declineController } = await request.json();
    const name = String(displayName || "").trim();
    if (!sessionCode || !name) return NextResponse.json({ error: "Game number and display name are required." }, { status: 400 });
    const { data: session } = await supabase.from("sessions").select("id,session_code,location,status").eq("session_code", String(sessionCode).trim()).eq("status", "active").single();
    if (!session) return NextResponse.json({ error: "That event is not active." }, { status: 404 });
    let { data: player } = await supabase.from("players").select("id,session_id,display_name,score,auth_user_id,left_at").eq("session_id", session.id).eq("auth_user_id", user.id).maybeSingle();
    if (!player) {
      const { data: duplicate } = await supabase.from("players").select("id").eq("session_id", session.id).ilike("display_name", name).maybeSingle();
      if (duplicate) return NextResponse.json({ error: "That display name is already in this event." }, { status: 409 });
      const inserted = await supabase.from("players").insert({ session_id: session.id, display_name: name, score: 0, joined_at: new Date().toISOString(), auth_user_id: user.id }).select("id,session_id,display_name,score,auth_user_id,left_at").single();
      if (inserted.error) throw inserted.error;
      player = inserted.data;
    }
    if (player?.left_at) {
      await supabase.from("players").update({ left_at: null }).eq("id", player.id);
      player.left_at = null;
    }
    let { data: control } = await supabase.from("session_controls").select("*").eq("session_id", session.id).maybeSingle();
    if (control?.state === "timeout") {
      const { data: claimedControl, error: claimError } = await supabase.from("session_controls").update({ decision_player_id: player.id, updated_at: new Date().toISOString() }).eq("session_id", session.id).eq("state", "timeout").select("*").single();
      if (claimError) throw claimError;
      control = claimedControl;
    }
    if (!control && !declineController) {
      const created = await supabase.from("session_controls").insert({ session_id: session.id, decision_player_id: player.id, state: "lobby" }).select("*").single();
      if (created.error) throw created.error;
      control = created.data;
    }
    return NextResponse.json({ session, player, control, controllerOffered: !control && Boolean(declineController) });
  } catch (error: any) { return NextResponse.json({ error: error.message || "Could not join the event." }, { status: 500 }); }
}
