/**
 * ORION — Institution Domain Service
 * Developer 2 (Shivani)
 */

import { createClient, createServiceClient } from "@/server/db/client";
import {
  Institution,
  InstitutionCreateInput,
  InstitutionCreateInputSchema,
} from "@/contracts/identity";

export async function createInstitution(
  input: InstitutionCreateInput,
  creator?: { userId: string; displayName: string }
): Promise<{ success: boolean; data?: Institution; error?: string }> {
  const parsed = InstitutionCreateInputSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const db = await createServiceClient();

  // Check if code already exists
  const { data: existing } = await db
    .from("institutions")
    .select("id")
    .eq("code", parsed.data.code.toUpperCase())
    .maybeSingle();

  if (existing) {
    return { success: false, error: "An institution with this code already exists." };
  }

  const newInst: Institution = {
    id: crypto.randomUUID(),
    name: parsed.data.name,
    code: parsed.data.code.toUpperCase(),
    approval_state: "pending",
    approved_by: null,
    created_at: new Date().toISOString(),
  };

  const { error } = await db.from("institutions").insert(newInst);
  if (error) {
    return { success: false, error: error.message };
  }

  if (creator) {
    const membershipId = crypto.randomUUID();
    const { error: profileError } = await db.from("profiles").upsert({
      id: creator.userId,
      display_name: creator.displayName,
    });
    if (profileError) return { success: false, error: profileError.message };
    const { error: membershipError } = await db.from("institution_memberships").insert({
      id: membershipId,
      institution_id: newInst.id,
      user_id: creator.userId,
      status: "active",
    });
    if (membershipError) return { success: false, error: membershipError.message };
    const { error: grantError } = await db.from("role_grants").insert({
      institution_id: newInst.id,
      membership_id: membershipId,
      role: "principal",
      granted_by: membershipId,
    });
    if (grantError) return { success: false, error: grantError.message };
  }

  return { success: true, data: newInst };
}

export async function approveInstitution(
  id: string,
  adminUserId: string
): Promise<{ success: boolean; data?: Institution; error?: string }> {
  const db = await createServiceClient();

  const { data: inst, error: fetchErr } = await db
    .from("institutions")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchErr || !inst) {
    return { success: false, error: "Institution not found." };
  }

  const updated: Institution = {
    ...inst,
    approval_state: "approved",
    approved_by: adminUserId,
  };

  const { error } = await db
    .from("institutions")
    .update({ approval_state: "approved", approved_by: adminUserId })
    .eq("id", id);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: updated };
}

export async function getInstitutionById(id: string): Promise<Institution | null> {
  const db = await createClient();
  const { data, error } = await db.from("institutions").select("*").eq("id", id).maybeSingle();
  if (error || !data) return null;
  return data as Institution;
}

export async function getInstitutionByCode(code: string): Promise<Institution | null> {
  const db = await createClient();
  const { data, error } = await db
    .from("institutions")
    .select("*")
    .eq("code", code.toUpperCase())
    .maybeSingle();
  if (error || !data) return null;
  return data as Institution;
}

export async function listApprovedInstitutions(): Promise<Institution[]> {
  const db = await createClient();
  const { data, error } = await db
    .from("institutions")
    .select("*")
    .eq("approval_state", "approved")
    .order("name", { ascending: true });

  if (error || !data) return [];
  return data as Institution[];
}
