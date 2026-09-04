/**
 * Compatibility names for feature-team services.
 *
 * User-scoped reads and writes must retain the authenticated browser session
 * so Postgres RLS remains authoritative. Elevated access is intentionally a
 * separate, explicit function for narrowly reviewed server-only workflows.
 */
export { createSupabaseSessionClient as createClient } from "@/server/auth/supabase-session";
export { createSupabaseAdmin as createServiceClient } from "@/server/db/supabase-admin";
