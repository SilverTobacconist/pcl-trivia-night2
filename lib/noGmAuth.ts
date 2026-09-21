import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

export function requestSupabase(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  return createClient(url, key, { global: { headers: authorization ? { Authorization: authorization } : {} } });
}

export async function requireAnonymousPlayer(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Please rejoin the game.");
  const supabase = requestSupabase(request);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new Error("Your player session has expired. Please rejoin.");
  return { supabase, user: data.user };
}
