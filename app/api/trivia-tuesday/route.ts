import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { createTriviaTuesdaySheet } from "@/lib/googleSheets";
import { hasBartenderAccess } from "@/lib/bartenderAuth";

function sessionCode() { return Math.floor(1000 + Math.random() * 9000).toString(); }
function eventCode(name: string) { return `${new Date().getFullYear()}${Math.random().toString(36).slice(2,6).toUpperCase()}`; }
function tabTitle(name: string) { return `TT ${name}`.replace(/[\\/?*[\]:]/g, " ").trim().slice(0, 80); }

export async function GET(request: Request) {
  if (!hasBartenderAccess(request)) return NextResponse.json({ error:"Bartender access is required." }, { status:401 });
  const supabase = getSupabaseAdmin();
  const location = new URL(request.url).searchParams.get("location");
  let query = supabase.from("trivia_tuesday_events").select("*").order("scheduled_start_at", { ascending: true });
  if (location) query = query.eq("location", location);
  const { data, error } = await query; if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ events: data || [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  try {
    if (!hasBartenderAccess(request)) return NextResponse.json({ error:"Bartender access is required." }, { status:401 });
    const supabase = getSupabaseAdmin();
    const body = await request.json();
    if (body.action === "create") {
      if (!["Hastings","Norfolk"].includes(body.location) || !body.eventName?.trim() || !body.scheduledStartAt) return NextResponse.json({ error:"Event name, location, and Central start time are required." }, { status:400 });
      const code = eventCode(body.eventName); const sheetName = tabTitle(`${new Date(body.scheduledStartAt).toLocaleDateString("en-US", { timeZone:"America/Chicago", month:"short", day:"numeric" })} ${body.eventName}`);
      const sheet = await createTriviaTuesdaySheet(sheetName, code);
      const { data, error } = await supabase.from("trivia_tuesday_events").insert({ event_name:body.eventName.trim(), location:body.location, scheduled_start_at:new Date(body.scheduledStartAt).toISOString(), question_sheet_name:sheet.title, board_theme:body.boardTheme || "pauls" }).select("*").single();
      if (error) return NextResponse.json({ error:error.message }, { status:500 });
      const { data: session, error: sessionError } = await supabase.from("sessions").insert({ session_code:sessionCode(), location:data.location, host_name:"Trivia Tuesday", created_at:new Date().toISOString(), game_mode:"main", status:"active", trivia_tuesday_event_id:data.id, trivia_tuesday_phase:"ordinary", is_test:false, question_status:"lobby" }).select("*").single();
      if (sessionError) return NextResponse.json({ error:sessionError.message }, { status:500 });
      await supabase.from("trivia_tuesday_events").update({ started_session_id:session.id }).eq("id",data.id);
      return NextResponse.json({ event:{ ...data, started_session_id:session.id }, session, sheetName:sheet.title });
    }
    if (body.action === "start" || body.action === "test") {
      const isTest = body.action === "test"; const { data:event, error:eventError } = await supabase.from("trivia_tuesday_events").select("*").eq("id",body.eventId).single();
      if (eventError || !event) return NextResponse.json({ error:"Trivia Tuesday event not found." }, { status:404 });
      if (!isTest) {
        if (event.status === "completed") return NextResponse.json({ error:"This Trivia Tuesday has already been played." }, { status:409 });
        if (Date.now() < new Date(event.scheduled_start_at).getTime() - 2 * 60 * 60 * 1000) return NextResponse.json({ error:"Trivia Tuesday opens two hours before its scheduled start." }, { status:409 });
      }
      let session: any = null;
      if (isTest) {
        const created = await supabase.from("sessions").insert({ session_code:sessionCode(), location:event.location, host_name:"Trivia Tuesday Test", created_at:new Date().toISOString(), game_mode:"main", status:"active", trivia_tuesday_event_id:event.id, trivia_tuesday_theme:event.board_theme, trivia_tuesday_phase:"seasonal", is_test:true, question_status:"lobby" }).select("*").single();
        if (created.error) return NextResponse.json({ error:created.error.message }, { status:500 }); session = created.data;
      } else {
        const existing = event.started_session_id ? await supabase.from("sessions").select("*").eq("id",event.started_session_id).maybeSingle() : { data:null };
        if (!existing.data) return NextResponse.json({ error:"This event needs its scheduled game session recreated." }, { status:409 });
        const activated = await supabase.from("sessions").update({ status:"active" }).eq("id",existing.data.id).select("*").single();
        if (activated.error) return NextResponse.json({ error:activated.error.message }, { status:500 }); session = activated.data;
        await supabase.from("trivia_tuesday_events").update({ status:"lobby" }).eq("id",event.id);
      }
      return NextResponse.json({ session, event });
    }
    return NextResponse.json({ error:"Unknown Trivia Tuesday action." }, { status:400 });
  } catch (error:any) { return NextResponse.json({ error:error.message || "Could not update Trivia Tuesday." }, { status:500 }); }
}
