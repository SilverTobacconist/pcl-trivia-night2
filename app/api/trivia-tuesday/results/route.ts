import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
export async function GET() {
  const { data, error } = await supabase.from("trivia_tuesday_leaderboard").select("*").order("completed_at",{ascending:false});
  if (error) return NextResponse.json({ error:error.message },{status:500});
  return NextResponse.json({ results:data||[] },{headers:{"Cache-Control":"no-store"}});
}
