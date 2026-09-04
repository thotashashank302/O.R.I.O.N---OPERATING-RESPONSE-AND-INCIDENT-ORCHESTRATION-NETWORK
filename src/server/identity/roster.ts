/**
 * ORION — Student Roster Domain Service
 * Developer 2 (Shivani)
 *
 * Implements ID-01: Matching verified roster email is required;
 * roll alone cannot claim another identity or join nonexistent college.
 */

import { createServiceClient } from "@/server/db/client";
import {
  RosterRowInput,
  RosterRowInputSchema,
  StudentRosterEntry,
} from "@/contracts/identity";

export async function addRosterRow(
  institutionId: string,
  input: RosterRowInput
): Promise<{ success: boolean; data?: StudentRosterEntry; error?: string }> {
  const parsed = RosterRowInputSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const db = await createServiceClient();

  // Verify institution exists
  const { data: inst } = await db
    .from("institutions")
    .select("id, approval_state")
    .eq("id", institutionId)
    .maybeSingle();

  if (!inst) {
    return { success: false, error: "Target institution not found." };
  }

  // Check unique roll number per institution
  const { data: existing } = await db
    .from("student_roster")
    .select("id")
    .eq("institution_id", institutionId)
    .eq("roll_number", parsed.data.roll_number.toUpperCase())
    .maybeSingle();

  if (existing) {
    return { success: false, error: "A student with this roll number already exists in this institution." };
  }

  const newEntry: StudentRosterEntry = {
    id: crypto.randomUUID(),
    institution_id: institutionId,
    roll_number: parsed.data.roll_number.toUpperCase(),
    roster_email: parsed.data.roster_email.toLowerCase(),
    department_id: parsed.data.department_id,
    year: parsed.data.year,
    section: parsed.data.section.toUpperCase(),
    claimed_user_id: null,
    created_at: new Date().toISOString(),
  };

  const { data: section } = await db.from("sections")
    .select("id")
    .eq("institution_id", institutionId)
    .eq("department_id", parsed.data.department_id)
    .eq("name", parsed.data.section.toUpperCase())
    .maybeSingle();
  if (!section) return { success: false, error: "Roster section was not found in this institution." };

  const { error } = await db.from("student_roster").insert({
    id: newEntry.id,
    institution_id: institutionId,
    roll_number: newEntry.roll_number,
    roster_email: newEntry.roster_email,
    department_id: newEntry.department_id,
    section_id: section.id,
    academic_year: newEntry.year,
    claimed_user_id: null,
  });
  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: newEntry };
}

export async function importRosterRows(
  institutionId: string,
  rows: RosterRowInput[]
): Promise<{ success: boolean; imported: number; errors: Array<{ row: number; error: string }> }> {
  let imported = 0;
  const errors: Array<{ row: number; error: string }> = [];

  for (let i = 0; i < rows.length; i++) {
    const res = await addRosterRow(institutionId, rows[i]);
    if (res.success) {
      imported++;
    } else {
      errors.push({ row: i + 1, error: res.error || "Unknown error" });
    }
  }

  return { success: errors.length === 0, imported, errors };
}

/**
 * Validates and claims a student identity against the approved roster.
 * Invariant ID-01: User email MUST match roster_email for the given roll_number.
 */
export async function claimStudentMembership(
  userId: string,
  userEmail: string,
  institutionCode: string,
  rollNumber: string
): Promise<{
  success: boolean;
  membershipId?: string;
  departmentId?: string;
  section?: string;
  error?: string;
}> {
  const db = await createServiceClient();

  // 1. Verify institution exists and is approved
  const { data: inst } = await db
    .from("institutions")
    .select("id, name, approval_state")
    .eq("code", institutionCode.toUpperCase())
    .maybeSingle();

  if (!inst) {
    return { success: false, error: "Invalid institution code: institution does not exist." };
  }

  if (inst.approval_state !== "approved") {
    return { success: false, error: "Institution is currently pending administrator approval." };
  }

  // 2. Find roster record by institution and roll number
  const { data: rosterEntry } = await db
    .from("student_roster")
    .select("*")
    .eq("institution_id", inst.id)
    .eq("roll_number", rollNumber.toUpperCase())
    .maybeSingle();

  if (!rosterEntry) {
    return {
      success: false,
      error: "Roll number not found in institution roster. Please contact your college administrator.",
    };
  }

  // 3. Invariant ID-01: matching verified roster email is required
  if (rosterEntry.roster_email.toLowerCase() !== userEmail.toLowerCase()) {
    return {
      success: false,
      error: "Email mismatch: The email on record for this roll number does not match your authenticated email.",
    };
  }

  // 4. Check if already claimed by another user
  if (rosterEntry.claimed_user_id && rosterEntry.claimed_user_id !== userId) {
    return {
      success: false,
      error: "This student roll number has already been claimed by another account.",
    };
  }
  const rosterSectionId = rosterEntry.section_id ?? rosterEntry.section;

  // 5. Create or retrieve active institution membership
  const { data: existingMembership } = await db
    .from("institution_memberships")
    .select("id, status")
    .eq("user_id", userId)
    .eq("institution_id", inst.id)
    .maybeSingle();

  let membershipId: string;

  if (existingMembership) {
    membershipId = existingMembership.id;
    if (existingMembership.status !== "active") {
      await db
        .from("institution_memberships")
        .update({ status: "active", updated_at: new Date().toISOString() })
        .eq("id", membershipId);
    }
  } else {
    membershipId = crypto.randomUUID();
    const newMembership = {
      id: membershipId,
      user_id: userId,
      institution_id: inst.id,
      status: "active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await db.from("institution_memberships").insert(newMembership);
  }

  // 6. Grant student role if not already granted
  const { data: existingRole } = await db
    .from("role_grants")
    .select("id")
    .eq("membership_id", membershipId)
    .eq("role", "student")
    .is("revoked_at", null)
    .maybeSingle();

  if (!existingRole) {
    const studentGrant = {
      id: crypto.randomUUID(),
      institution_id: inst.id,
      membership_id: membershipId,
      role: "student",
      department_id: rosterEntry.department_id,
      section_id: rosterSectionId,
      starts_at: new Date().toISOString(),
      ends_at: null,
      granted_by: membershipId,
      revoked_at: null,
    };
    await db.from("role_grants").insert(studentGrant);
  }

  // 7. Update claimed_user_id on roster entry
  await db
    .from("student_roster")
    .update({ claimed_user_id: userId })
    .eq("id", rosterEntry.id);

  return {
    success: true,
    membershipId,
    departmentId: rosterEntry.department_id,
    section: rosterSectionId,
  };
}
