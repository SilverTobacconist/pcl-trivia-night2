"use client";

import { createClient } from "@supabase/supabase-js";

export const browserSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

export async function anonymousAccessToken() {
  let { data } = await browserSupabase.auth.getSession();
  if (!data.session) {
    const created = await browserSupabase.auth.signInAnonymously();
    if (created.error) throw created.error;
    data = created.data;
  }
  if (!data.session?.access_token) throw new Error("Could not create your player session.");
  return data.session.access_token;
}
