import { createClient } from "@supabase/supabase-js";
import { getSupabaseServerEnv } from "@/server/env";
import type { Database } from "@/contracts/database";

export function createSupabaseAdmin() {
  const env = getSupabaseServerEnv();
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
