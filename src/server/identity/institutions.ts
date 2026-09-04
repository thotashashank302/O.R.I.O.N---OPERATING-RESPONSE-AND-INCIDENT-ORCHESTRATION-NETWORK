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
  input: InstitutionCreateInput
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

  return { success: true, data: newInst };
}

export async function approveInstitution(
  id: string,
  adminEmail: string
): Promise<{ success: boolean; data?: Institution; error?: string }> {
  // Allowlisted demo bootstrap or configured admin email check
  const allowedAdmins = (process.env.DEMO_ADMIN_EMAILS || "demo.admin@orion.edu,principal@orion.edu,admin@orion.edu")
    .split(",")
    .map((e) => e.trim().toLowerCase());

  const isDemoMode = process.env.DEMO_MODE === "true" || process.env.NODE_ENV !== "production";

  if (!isDemoMode && !allowedAdmins.includes(adminEmail.toLowerCase())) {
    return { success: false, error: "Unauthorized: Admin email is not in the allowlist for bootstrap approval." };
  }

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
    approved_by: adminEmail,
  };

  const { error } = await db
    .from("institutions")
    .update({ approval_state: "approved", approved_by: adminEmail })
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
