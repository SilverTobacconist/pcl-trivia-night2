import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function POST(request: Request) {
  try {
    const { action, location } = await request.json();
    if (!['Hastings', 'Norfolk'].includes(location)) return NextResponse.json({ error: 'Choose Hastings or Norfolk.' }, { status: 400 });
    if (action === 'reset_questions') {
      const { data: sessions } = await supabase.from('sessions').select('id').eq('location', location);
      const ids = (sessions || []).map((session) => session.id);
      if (ids.length) { const { error } = await supabase.from('question_history').delete().in('session_id', ids); if (error) throw error; }
      return NextResponse.json({ ok: true, message: `${location} question history has been reset.` });
    }
    return NextResponse.json({ error: 'Unknown bartender action.' }, { status: 400 });
  } catch (error: any) { return NextResponse.json({ error: error.message || 'Could not update questions.' }, { status: 500 }); }
}
