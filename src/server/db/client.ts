/**
 * ORION — Supabase Server Client
 * Developer 1 (Shashank) owns the final version.
 * D4 provides this stub; D1 replaces with full server auth integration.
 *
 * Uses @supabase/ssr for cookie-based server auth.
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server component — cookie writes ignored
          }
        },
      },
    }
  );
}

/**
 * Creates a Supabase client using the secret service key.
 * For use ONLY in server-side route handlers where RLS needs to be bypassed
 * with explicit application-level checks. NEVER expose to client.
 */
export async function createServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      cookies: { getAll: () => [], setAll: () => {} },
      auth: { persistSession: false },
    }
  );
}
