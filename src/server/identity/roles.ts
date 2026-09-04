/**
 * ORION — Role Management & Authority Domain Service
 * Developer 2 (Shivani)
 *
 * Implements ID-02, ID-04, and CORE-02:
 * - Two concurrently occupied CR seats per section/term (Seat 1 & 2).
 * - HOD scoped appointment/revocation of CRs.
 * - Server-side immediate enforcement of active/inactive membership.
 * - Context-switch state resolution across institutions and roles.
 */

import { createClient, createServiceClient } from "@/server/db/client";
import {
  RoleEnum,
  RoleGrant,
  RoleGrantInput,
  RoleGrantInputSchema,
  UserContextItem,
  UserContextResponse,
} from "@/contracts/identity";

/**
 * Validates whether the grantor has authority to issue the target role.
 */
function canGrantRole(
  grantorRoles: RoleEnum[],
  targetRole: RoleEnum,
  grantorDeptId?: string | null,
  targetDeptId?: string | null
): boolean {
  // Principal and Admin can grant any role
  if (grantorRoles.includes("principal") || grantorRoles.includes("admin")) {
    return true;
  }

  // HOD can ONLY grant CR within their own department
  if (grantorRoles.includes("hod") && targetRole === "cr") {
    if (!grantorDeptId || !targetDeptId) return false;
    return grantorDeptId === targetDeptId;
  }

  return false;
}

export async function grantRole(
  grantedByMembershipId: string,
  input: RoleGrantInput
): Promise<{ success: boolean; data?: RoleGrant; error?: string }> {
  const parsed = RoleGrantInputSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const db = await createServiceClient();

  // 1. Verify grantor membership and active status
  const { data: grantorMembership } = await db
    .from("institution_memberships")
    .select("id, institution_id, status")
    .eq("id", grantedByMembershipId)
    .maybeSingle();

  if (!grantorMembership || grantorMembership.status !== "active") {
    return { success: false, error: "Grantor membership is inactive or invalid." };
  }

  // 2. Verify target membership belongs to the same institution
  const { data: targetMembership } = await db
    .from("institution_memberships")
    .select("id, institution_id, status")
    .eq("id", parsed.data.membership_id)
    .maybeSingle();

  if (!targetMembership || targetMembership.institution_id !== grantorMembership.institution_id) {
    return { success: false, error: "Target member belongs to a different institution." };
  }

  if (targetMembership.status !== "active") {
    return { success: false, error: "Cannot grant roles to an inactive member." };
  }

  // 3. Prevent self-selection of privileged roles (ID-02)
  if (grantedByMembershipId === parsed.data.membership_id && parsed.data.role !== "student") {
    return { success: false, error: "Users cannot self-assign privileged administrative or staff roles." };
  }

  // 4. Fetch grantor active roles
  const { data: grantorGrants } = await db
    .from("role_grants")
    .select("role, department_id")
    .eq("membership_id", grantedByMembershipId)
    .is("revoked_at", null);

  const grantorRoleList = (grantorGrants || []).map((g) => g.role as RoleEnum);
  const grantorDeptId = grantorGrants?.find((g) => g.role === "hod")?.department_id;

  if (!canGrantRole(grantorRoleList, parsed.data.role, grantorDeptId, parsed.data.department_id)) {
    return {
      success: false,
      error: "Unauthorized: You do not have permission to grant this role or department scope.",
    };
  }

  // 5. Two CR seats per section/term constraint (CORE-02)
  if (parsed.data.role === "cr") {
    if (!parsed.data.department_id || !parsed.data.section) {
      return { success: false, error: "CR appointment requires department and section specification." };
    }

    const seatNumber = parsed.data.seat_number || 1;
    if (seatNumber < 1 || seatNumber > 2) {
      return { success: false, error: "Invalid CR seat number. Only Seat 1 and Seat 2 are available." };
    }

    // Check if the specific seat is already occupied by an active CR
    const { data: existingActiveSeat } = await db
      .from("role_grants")
      .select("id, membership_id")
      .eq("role", "cr")
      .eq("department_id", parsed.data.department_id)
      .eq("section", parsed.data.section)
      .eq("seat_number", seatNumber)
      .is("revoked_at", null)
      .maybeSingle();

    if (existingActiveSeat) {
      return {
        success: false,
        error: `CR Seat ${seatNumber} is already actively occupied in this section. Revoke or replace the existing CR first.`,
      };
    }

    // Ensure total active CRs in this section does not exceed 2
    const { data: totalActiveCRs } = await db
      .from("role_grants")
      .select("id")
      .eq("role", "cr")
      .eq("department_id", parsed.data.department_id)
      .eq("section", parsed.data.section)
      .is("revoked_at", null);

    if (totalActiveCRs && totalActiveCRs.length >= 2) {
      return {
        success: false,
        error: "Maximum of 2 active CR seats per section has already been reached.",
      };
    }
  }

  const newGrant: RoleGrant = {
    id: crypto.randomUUID(),
    membership_id: parsed.data.membership_id,
    role: parsed.data.role,
    department_id: parsed.data.department_id || null,
    section: parsed.data.section || null,
    seat_number: parsed.data.seat_number || null,
    club_id: parsed.data.club_id || null,
    starts_at: parsed.data.starts_at || new Date().toISOString(),
    ends_at: parsed.data.ends_at || null,
    granted_by_membership_id: grantedByMembershipId,
    revoked_at: null,
    revocation_reason: null,
  };

  const { error } = await db.from("role_grants").insert(newGrant);
  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: newGrant };
}

export async function revokeRole(
  revokedByMembershipId: string,
  grantId: string,
  reason: string,
  replacementMembershipId?: string
): Promise<{ success: boolean; error?: string }> {
  const db = await createServiceClient();

  // 1. Fetch existing grant
  const { data: grant } = await db
    .from("role_grants")
    .select("*, institution_memberships!inner(institution_id)")
    .eq("id", grantId)
    .is("revoked_at", null)
    .maybeSingle();

  if (!grant) {
    return { success: false, error: "Active role grant not found." };
  }

  // 2. Verify revoker has authority
  const { data: revokerMembership } = await db
    .from("institution_memberships")
    .select("id, institution_id, status")
    .eq("id", revokedByMembershipId)
    .maybeSingle();

  if (!revokerMembership || revokerMembership.status !== "active") {
    return { success: false, error: "Revoker session is inactive or invalid." };
  }

  const { data: revokerGrants } = await db
    .from("role_grants")
    .select("role, department_id")
    .eq("membership_id", revokedByMembershipId)
    .is("revoked_at", null);

  const revokerRoles = (revokerGrants || []).map((g) => g.role as RoleEnum);
  const revokerDeptId = revokerGrants?.find((g) => g.role === "hod")?.department_id;

  if (!canGrantRole(revokerRoles, grant.role as RoleEnum, revokerDeptId, grant.department_id)) {
    return { success: false, error: "Unauthorized: You cannot revoke this role grant." };
  }

  const now = new Date().toISOString();

  // 3. Mark grant revoked
  const { error: revokeErr } = await db
    .from("role_grants")
    .update({
      revoked_at: now,
      revocation_reason: reason,
    })
    .eq("id", grantId);

  if (revokeErr) {
    return { success: false, error: revokeErr.message };
  }

  // 4. Reassign stranded verifications (CORE-02 / 09_EXECUTION_DECISIONS section 3)
  // If the revoked grant was a CR or verifier, reassign pending incidents to remaining CR or HOD
  if (grant.role === "cr" && grant.department_id && grant.section) {
    const { data: remainingCR } = await db
      .from("role_grants")
      .select("membership_id")
      .eq("role", "cr")
      .eq("department_id", grant.department_id)
      .eq("section", grant.section)
      .is("revoked_at", null)
      .maybeSingle();

    const fallbackVerifierId = remainingCR?.membership_id || revokedByMembershipId;

    await db
      .from("incidents")
      .update({ designated_verifier_membership_id: fallbackVerifierId })
      .eq("designated_verifier_membership_id", grant.membership_id)
      .in("state", ["assigned", "in_progress", "submitted_for_verification"]);
  }

  // 5. If replacement is requested, grant the same seat to replacement member
  if (replacementMembershipId) {
    await grantRole(revokedByMembershipId, {
      membership_id: replacementMembershipId,
      role: grant.role as RoleEnum,
      department_id: grant.department_id,
      section: grant.section,
      seat_number: grant.seat_number,
      club_id: grant.club_id,
    });
  }

  return { success: true };
}

/**
 * Retrieves all institution contexts and active roles for a user.
 */
export async function getUserContexts(userId: string): Promise<UserContextResponse | null> {
  const db = await createServiceClient();

  const { data: memberships, error } = await db
    .from("institution_memberships")
    .select(`
      id,
      institution_id,
      status,
      institutions!inner(id, name, code)
    `)
    .eq("user_id", userId);

  if (error || !memberships) {
    return null;
  }

  const contexts: UserContextItem[] = [];

  for (const m of memberships as any[]) {
    const { data: grants } = await db
      .from("role_grants")
      .select(`
        role,
        department_id,
        section,
        seat_number,
        club_id,
        departments(name)
      `)
      .eq("membership_id", m.id)
      .is("revoked_at", null);

    contexts.push({
      institution_id: m.institution_id,
      institution_name: m.institutions.name,
      institution_code: m.institutions.code,
      membership_id: m.id,
      membership_status: m.status,
      roles: (grants || []).map((g: any) => ({
        role: g.role,
        department_id: g.department_id,
        department_name: g.departments?.name || null,
        section: g.section,
        seat_number: g.seat_number,
        club_id: g.club_id,
      })),
    });
  }

  // Active context: first active membership
  const activeContext = contexts.find((c) => c.membership_status === "active") || contexts[0] || null;

  return {
    user_id: userId,
    email: "",
    display_name: "",
    contexts,
    active_context: activeContext,
  };
}

/**
 * Instant server-side verification of active membership and specific required role.
 * Invariant ID-04: Inactive membership blocks existing sessions.
 */
export async function verifyActiveMembershipAndRole(
  membershipId: string,
  requiredRole?: RoleEnum
): Promise<{ valid: boolean; error?: string; membership?: any; roles?: RoleEnum[] }> {
  const db = await createServiceClient();

  const { data: membership } = await db
    .from("institution_memberships")
    .select("id, user_id, institution_id, status")
    .eq("id", membershipId)
    .maybeSingle();

  if (!membership) {
    return { valid: false, error: "Membership not found." };
  }

  if (membership.status !== "active") {
    return { valid: false, error: "Membership has been deactivated by an administrator." };
  }

  const { data: grants } = await db
    .from("role_grants")
    .select("role")
    .eq("membership_id", membershipId)
    .is("revoked_at", null);

  const activeRoles = (grants || []).map((g) => g.role as RoleEnum);

  if (requiredRole && !activeRoles.includes(requiredRole) && !activeRoles.includes("admin") && !activeRoles.includes("principal")) {
    return { valid: false, error: `Required role '${requiredRole}' is not active on this account.` };
  }

  return { valid: true, membership, roles: activeRoles };
}
