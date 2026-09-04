/**
 * ORION — Staff Capabilities & Confidential Case Eligibility
 * Developer 2 (Shivani)
 *
 * Implements RP-03 & B2:
 * - Staff capability management (skills, zones, default off_duty, workload limits).
 * - Confidential-case access control: Accused staff or CR cannot see or route their own complaint.
 * - Transport & Club membership authority helpers.
 */

import { createClient, createServiceClient } from "@/server/db/client";
import {
  StaffCapability,
  StaffCapabilityInput,
  StaffCapabilityInputSchema,
  TransportEnrollment,
  TransportEnrollmentInput,
  ClubTerm,
  ClubTermInput,
} from "@/contracts/identity";

export async function getStaffCapabilities(
  membershipId: string
): Promise<StaffCapability | null> {
  const db = await createClient();
  const { data, error } = await db
    .from("staff_capabilities")
    .select("*")
    .eq("membership_id", membershipId)
    .maybeSingle();

  if (error || !data) return null;
  return data as StaffCapability;
}

export async function updateStaffCapabilities(
  membershipId: string,
  input: StaffCapabilityInput,
  updatedByMembershipId?: string
): Promise<{ success: boolean; data?: StaffCapability; error?: string }> {
  const parsed = StaffCapabilityInputSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const db = await createServiceClient();

  const { data: existing } = await db
    .from("staff_capabilities")
    .select("id, availability")
    .eq("membership_id", membershipId)
    .maybeSingle();

  const now = new Date().toISOString();

  if (existing) {
    const { data: updated, error } = await db
      .from("staff_capabilities")
      .update({
        skills: parsed.data.skills,
        zones: parsed.data.zones,
        workload_limit: parsed.data.workload_limit,
        updated_by: updatedByMembershipId || null,
        updated_at: now,
      })
      .eq("id", existing.id)
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data: updated as StaffCapability };
  } else {
    const newCap: StaffCapability = {
      id: crypto.randomUUID(),
      membership_id: membershipId,
      skills: parsed.data.skills,
      zones: parsed.data.zones,
      availability: "off_duty", // Starts off_duty by default
      workload_limit: parsed.data.workload_limit,
      updated_by: updatedByMembershipId || null,
      updated_at: now,
    };

    const { error } = await db.from("staff_capabilities").insert(newCap);
    if (error) return { success: false, error: error.message };
    return { success: true, data: newCap };
  }
}

/**
 * Confidential-case access validation (RP-03).
 * Accused staff or CR cannot see, triage, or route complaints filed against them.
 */
export function checkConfidentialCaseAccess(
  reporterMembershipId: string,
  accusedMembershipIds: string[],
  requestingMembershipId: string,
  isAuthorizedAdminOrPrincipal: boolean
): { allowed: boolean; reason?: string } {
  // If the requesting user is one of the accused, immediately DENY
  if (accusedMembershipIds.includes(requestingMembershipId)) {
    return {
      allowed: false,
      reason: "Access denied: You are named in this confidential record and cannot view or route it.",
    };
  }

  // Reporter can view their own filed complaint
  if (requestingMembershipId === reporterMembershipId) {
    return { allowed: true };
  }

  // Only authorized principal or non-conflicted admin can view
  if (isAuthorizedAdminOrPrincipal) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: "Access denied: This is a confidential case restricted to authorized handlers.",
  };
}

/**
 * Transport enrollment verification (B3).
 */
export async function enrollTransport(
  input: TransportEnrollmentInput,
  verifiedByMembershipId?: string
): Promise<{ success: boolean; data?: TransportEnrollment; error?: string }> {
  const db = await createServiceClient();

  const newEnrollment: TransportEnrollment = {
    id: crypto.randomUUID(),
    membership_id: input.membership_id,
    route_id: input.route_id,
    bus_number: input.bus_number,
    verified_by_membership_id: verifiedByMembershipId || null,
    active: true,
    created_at: new Date().toISOString(),
  };

  const { error } = await db.from("transport_enrollments").insert(newEnrollment);
  if (error) return { success: false, error: error.message };
  return { success: true, data: newEnrollment };
}

/**
 * Club term grant verification (B3).
 */
export async function createClubTerm(
  institutionId: string,
  input: ClubTermInput
): Promise<{ success: boolean; data?: ClubTerm; error?: string }> {
  const db = await createServiceClient();

  const newTerm: ClubTerm = {
    id: crypto.randomUUID(),
    institution_id: institutionId,
    club_name: input.club_name,
    president_membership_id: input.president_membership_id,
    starts_at: input.starts_at,
    ends_at: input.ends_at,
    created_at: new Date().toISOString(),
  };

  const { error } = await db.from("club_terms").insert(newTerm);
  if (error) return { success: false, error: error.message };

  // Grant club_president role for the term
  await db.from("role_grants").insert({
    id: crypto.randomUUID(),
    membership_id: input.president_membership_id,
    role: "club_president",
    club_id: newTerm.id,
    starts_at: input.starts_at,
    ends_at: input.ends_at,
  });

  return { success: true, data: newTerm };
}
