import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/contracts/database";

/** Selection is a preference only; ownership and active status are rechecked. */
export async function activeMembership(client: SupabaseClient<Database>, userId: string) {
  const selected = (await cookies()).get("orion-membership")?.value;
  let query = client.from("institution_memberships").select("id,institution_id,status")
    .eq("user_id", userId).eq("status", "active");
  if (selected) query = query.eq("id", selected);
  return query.order("id").limit(1).maybeSingle();
}
