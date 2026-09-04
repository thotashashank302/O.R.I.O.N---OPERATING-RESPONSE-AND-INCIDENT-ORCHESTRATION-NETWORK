/**
 * ORION — Campus Locations & Responsible Groups Domain Service
 * Developer 2 (Shivani)
 */

import { createClient, createServiceClient } from "@/server/db/client";
import {
  CampusLocation,
  CampusLocationCreateInput,
  CampusLocationCreateInputSchema,
} from "@/contracts/identity";
import { CATEGORY_HANDLER_MAP } from "@/contracts/category-handlers";

export { CATEGORY_HANDLER_MAP } from "@/contracts/category-handlers";

export async function createLocation(
  institutionId: string,
  input: CampusLocationCreateInput
): Promise<{ success: boolean; data?: CampusLocation; error?: string }> {
  const parsed = CampusLocationCreateInputSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const db = await createServiceClient();

  // If parent_id is supplied, verify it exists and belongs to the same institution
  if (parsed.data.parent_id) {
    const { data: parent } = await db
      .from("campus_locations")
      .select("id, institution_id")
      .eq("id", parsed.data.parent_id)
      .maybeSingle();

    if (!parent || parent.institution_id !== institutionId) {
      return { success: false, error: "Parent location does not belong to this institution." };
    }
  }

  const newLocation: CampusLocation = {
    id: crypto.randomUUID(),
    institution_id: institutionId,
    parent_id: parsed.data.parent_id || null,
    kind: parsed.data.kind,
    label: parsed.data.label,
    asset_counts: parsed.data.asset_counts || {},
    created_at: new Date().toISOString(),
  };

  const { error } = await db.from("campus_locations").insert(newLocation);
  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: newLocation };
}

export async function listLocations(
  institutionId: string,
  kind?: string
): Promise<CampusLocation[]> {
  const db = await createClient();

  let query = db
    .from("campus_locations")
    .select("*")
    .eq("institution_id", institutionId)
    .order("label", { ascending: true });

  if (kind) {
    query = query.eq("kind", kind);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return data as CampusLocation[];
}

export function getCategoryResponsibleGroup(category: string) {
  return CATEGORY_HANDLER_MAP[category] || {
    responsibleGroup: "Operations Supervisor",
    defaultVerifier: "Supervisor Selected Verifier",
    isSafetyCritical: false,
  };
}
