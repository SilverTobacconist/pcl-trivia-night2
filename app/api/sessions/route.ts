import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

function createSessionCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { location, hostName } = body;

    const { data, error } = await supabase
      .from("sessions")
      .insert({
        session_code: createSessionCode(),
        location,
        host_name: hostName,
        game_mode: "main",
        status: "active",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message, details: error },
        { status: 500 }
      );
    }

    return NextResponse.json({ session: data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}