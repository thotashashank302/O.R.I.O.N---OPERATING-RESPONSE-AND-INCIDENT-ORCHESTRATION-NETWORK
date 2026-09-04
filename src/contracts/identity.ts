/**
 * ORION — Identity & Institution Technical Contracts
 * Developer 2 (Shivani) — Source of Truth
 */

import { z } from "zod";

// ==========================================
// 1. Core Enums
// ==========================================

export const InstitutionApprovalState = z.enum(["pending", "approved", "rejected"]);
export type InstitutionApprovalState = z.infer<typeof InstitutionApprovalState>;

export const MembershipStatus = z.enum(["active", "inactive"]);
export type MembershipStatus = z.infer<typeof MembershipStatus>;

export const DepartmentKind = z.enum(["academic", "service"]);
export type DepartmentKind = z.infer<typeof DepartmentKind>;

export const LocationKind = z.enum(["block", "floor", "room", "lab", "facility", "outdoor"]);
export type LocationKind = z.infer<typeof LocationKind>;

export const RoleEnum = z.enum([
  "principal",
  "admin",
  "hod",
  "cr",
  "staff",
  "student",
  "transport_admin",
  "club_president",
]);
export type RoleEnum = z.infer<typeof RoleEnum>;

export const StaffAvailabilityEnum = z.enum(["available", "busy", "off_duty"]);
export type StaffAvailabilityEnum = z.infer<typeof StaffAvailabilityEnum>;

// ==========================================
// 2. Institutions & Campus Structure
// ==========================================

export const InstitutionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2, "Institution name must be at least 2 characters"),
  code: z.string().min(2).max(20).toUpperCase(),
  approval_state: InstitutionApprovalState.default("pending"),
  approved_by: z.string().nullable().optional(),
  created_at: z.string(),
});
export type Institution = z.infer<typeof InstitutionSchema>;

export const InstitutionCreateInputSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(2).max(20).toUpperCase(),
});
export type InstitutionCreateInput = z.infer<typeof InstitutionCreateInputSchema>;

export const InstitutionApproveInputSchema = z.object({
  admin_email: z.string().email(),
  admin_passcode: z.string().optional(),
});
export type InstitutionApproveInput = z.infer<typeof InstitutionApproveInputSchema>;

export const DepartmentSchema = z.object({
  id: z.string().min(1),
  institution_id: z.string().min(1),
  name: z.string().min(1),
  code: z.string().min(1).max(20).toUpperCase(),
  kind: DepartmentKind.default("academic"),
  created_at: z.string(),
});
export type Department = z.infer<typeof DepartmentSchema>;

export const CampusLocationSchema = z.object({
  id: z.string().min(1),
  institution_id: z.string().min(1),
  parent_id: z.string().min(1).nullable().optional(),
  kind: LocationKind,
  label: z.string().min(1),
  asset_counts: z.record(z.string(), z.number()).default({}),
  created_at: z.string(),
});
export type CampusLocation = z.infer<typeof CampusLocationSchema>;

export const CampusLocationCreateInputSchema = z.object({
  parent_id: z.string().min(1).nullable().optional(),
  kind: LocationKind,
  label: z.string().min(1),
  asset_counts: z.record(z.string(), z.number()).optional().default({}),
});
export type CampusLocationCreateInput = z.infer<typeof CampusLocationCreateInputSchema>;

// ==========================================
// 3. Roster & Student Claims
// ==========================================

export const StudentRosterEntrySchema = z.object({
  id: z.string().min(1),
  institution_id: z.string().min(1),
  roll_number: z.string().min(1).toUpperCase(),
  roster_email: z.string().email().toLowerCase(),
  department_id: z.string().min(1),
  year: z.number().int().min(1).max(6),
  section: z.string().min(1).max(5).toUpperCase(),
  claimed_user_id: z.string().nullable().optional(),
  created_at: z.string(),
});
export type StudentRosterEntry = z.infer<typeof StudentRosterEntrySchema>;

export const RosterRowInputSchema = z.object({
  roll_number: z.string().min(1).toUpperCase(),
  roster_email: z.string().email().toLowerCase(),
  department_id: z.string().min(1),
  year: z.number().int().min(1).max(6),
  section: z.string().min(1).max(5).toUpperCase(),
});
export type RosterRowInput = z.infer<typeof RosterRowInputSchema>;

export const RosterImportInputSchema = z.object({
  rows: z.array(RosterRowInputSchema).min(1),
});
export type RosterImportInput = z.infer<typeof RosterImportInputSchema>;

export const MembershipClaimInputSchema = z.object({
  institution_code: z.string().min(1).toUpperCase(),
  roll_number: z.string().min(1).toUpperCase(),
  email: z.string().email().toLowerCase(),
});
export type MembershipClaimInput = z.infer<typeof MembershipClaimInputSchema>;

// ==========================================
// 4. Memberships & Role Grants
// ==========================================

export const InstitutionMembershipSchema = z.object({
  id: z.string().min(1),
  user_id: z.string().min(1),
  institution_id: z.string().min(1),
  status: MembershipStatus.default("active"),
  created_at: z.string(),
  updated_at: z.string(),
});
export type InstitutionMembership = z.infer<typeof InstitutionMembershipSchema>;

export const MembershipStatusPatchSchema = z.object({
  status: MembershipStatus,
  reason: z.string().min(1).optional(),
});
export type MembershipStatusPatch = z.infer<typeof MembershipStatusPatchSchema>;

export const RoleGrantSchema = z.object({
  id: z.string().min(1),
  membership_id: z.string().min(1),
  role: RoleEnum,
  department_id: z.string().min(1).nullable().optional(),
  section: z.string().nullable().optional(),
  seat_number: z.number().int().min(1).max(2).nullable().optional(), // 2 CR seats per section/term
  club_id: z.string().min(1).nullable().optional(),
  starts_at: z.string(),
  ends_at: z.string().nullable().optional(),
  granted_by_membership_id: z.string().min(1).nullable().optional(),
  revoked_at: z.string().nullable().optional(),
  revocation_reason: z.string().nullable().optional(),
});
export type RoleGrant = z.infer<typeof RoleGrantSchema>;

export const RoleGrantInputSchema = z.object({
  membership_id: z.string().min(1),
  role: RoleEnum,
  department_id: z.string().min(1).nullable().optional(),
  section: z.string().nullable().optional(),
  seat_number: z.number().int().min(1).max(2).nullable().optional(),
  club_id: z.string().min(1).nullable().optional(),
  starts_at: z.string().optional(),
  ends_at: z.string().nullable().optional(),
});
export type RoleGrantInput = z.infer<typeof RoleGrantInputSchema>;

export const RoleRevokeInputSchema = z.object({
  reason: z.string().min(1),
  replacement_membership_id: z.string().min(1).optional(),
  seat_number: z.number().int().min(1).max(2).optional(),
});
export type RoleRevokeInput = z.infer<typeof RoleRevokeInputSchema>;

// ==========================================
// 5. Staff Capabilities & Zones
// ==========================================

export const StaffCapabilitySchema = z.object({
  id: z.string().min(1),
  membership_id: z.string().min(1),
  skills: z.array(z.string()).default([]),
  zones: z.array(z.string()).default([]),
  availability: StaffAvailabilityEnum.default("off_duty"),
  workload_limit: z.number().int().min(1).max(20).default(5),
  updated_by: z.string().min(1).nullable().optional(),
  updated_at: z.string(),
});
export type StaffCapability = z.infer<typeof StaffCapabilitySchema>;

export const StaffCapabilityInputSchema = z.object({
  skills: z.array(z.string()),
  zones: z.array(z.string()),
  workload_limit: z.number().int().min(1).max(20).default(5),
});
export type StaffCapabilityInput = z.infer<typeof StaffCapabilityInputSchema>;

// ==========================================
// 6. Transport & Club Terms
// ==========================================

export const TransportEnrollmentSchema = z.object({
  id: z.string().min(1),
  membership_id: z.string().min(1),
  route_id: z.string().min(1),
  bus_number: z.string().min(1),
  verified_by_membership_id: z.string().min(1).nullable().optional(),
  active: z.boolean().default(true),
  created_at: z.string(),
});
export type TransportEnrollment = z.infer<typeof TransportEnrollmentSchema>;

export const TransportEnrollmentInputSchema = z.object({
  membership_id: z.string().min(1),
  route_id: z.string().min(1),
  bus_number: z.string().min(1),
});
export type TransportEnrollmentInput = z.infer<typeof TransportEnrollmentInputSchema>;

export const ClubTermSchema = z.object({
  id: z.string().min(1),
  institution_id: z.string().min(1),
  club_name: z.string().min(1),
  president_membership_id: z.string().min(1),
  starts_at: z.string(),
  ends_at: z.string(),
  created_at: z.string(),
});
export type ClubTerm = z.infer<typeof ClubTermSchema>;

export const ClubTermInputSchema = z.object({
  club_name: z.string().min(1),
  president_membership_id: z.string().min(1),
  starts_at: z.string(),
  ends_at: z.string(),
});
export type ClubTermInput = z.infer<typeof ClubTermInputSchema>;

// ==========================================
// 7. Context Switching Contract
// ==========================================

export const UserContextItemSchema = z.object({
  institution_id: z.string().min(1),
  institution_name: z.string(),
  institution_code: z.string(),
  membership_id: z.string().min(1),
  membership_status: MembershipStatus,
  roles: z.array(
    z.object({
      role: RoleEnum,
      department_id: z.string().min(1).nullable().optional(),
      department_name: z.string().nullable().optional(),
      section: z.string().nullable().optional(),
      seat_number: z.number().nullable().optional(),
      club_id: z.string().min(1).nullable().optional(),
    })
  ),
});
export type UserContextItem = z.infer<typeof UserContextItemSchema>;

export const UserContextResponseSchema = z.object({
  user_id: z.string().min(1),
  email: z.string().email(),
  display_name: z.string(),
  contexts: z.array(UserContextItemSchema),
  active_context: UserContextItemSchema.nullable().optional(),
});
export type UserContextResponse = z.infer<typeof UserContextResponseSchema>;
