import { z } from "zod";

export const membershipStatusSchema = z.enum(["active", "inactive"]);
export const availabilitySchema = z.enum(["available", "busy", "off_duty"]);
export const incidentStateSchema = z.enum([
  "reported", "triaging", "needs_clarification", "planned", "awaiting_approval",
  "assigned", "acknowledged", "in_progress", "submitted_for_verification",
  "resolved", "reopened", "escalated", "cancelled",
]);
export const taskStateSchema = z.enum([
  "pending", "ready", "assigned", "acknowledged", "in_progress", "blocked",
  "submitted", "verified", "failed", "cancelled",
]);
export const assignmentStateSchema = z.enum([
  "offered", "acknowledged", "active", "handover_requested", "released", "completed", "cancelled",
]);
export const jobStatusSchema = z.enum(["queued", "running", "succeeded", "retry_wait", "dead"]);
export const emailStatusSchema = z.enum(["queued", "sending", "sent", "delivered", "failed", "bounced", "suppressed"]);
export const visibilitySchema = z.enum(["routine", "restricted", "confidential"]);
export const severitySchema = z.enum(["low", "normal", "high", "critical"]);
export const roleSchema = z.enum([
  "principal", "admin", "hod", "supervisor", "cr", "student", "staff",
  "transport_admin", "president", "coordinator", "safeguarding_officer",
]);

export type MembershipStatus = z.infer<typeof membershipStatusSchema>;
export type Availability = z.infer<typeof availabilitySchema>;
export type IncidentState = z.infer<typeof incidentStateSchema>;
export type TaskState = z.infer<typeof taskStateSchema>;
export type AssignmentState = z.infer<typeof assignmentStateSchema>;
export type JobStatus = z.infer<typeof jobStatusSchema>;
export type EmailStatus = z.infer<typeof emailStatusSchema>;
export type Visibility = z.infer<typeof visibilitySchema>;
export type Severity = z.infer<typeof severitySchema>;
export type Role = z.infer<typeof roleSchema>;

export const authorizedContextSchema = z.object({
  requestId: z.string().min(1),
  userId: z.string().uuid(),
  membershipId: z.string().uuid(),
  institutionId: z.string().uuid(),
  roles: z.array(roleSchema).min(1),
  departmentIds: z.array(z.string().uuid()).default([]),
  sectionIds: z.array(z.string().uuid()).default([]),
});

export type AuthorizedContext = z.infer<typeof authorizedContextSchema>;

export const incidentContextSchema = z.object({
  id: z.string().uuid(),
  institutionId: z.string().uuid(),
  version: z.number().int().positive(),
  planVersion: z.number().int().nonnegative(),
  description: z.string().min(1).max(5000),
  category: z.string().min(1),
  locationId: z.string().uuid().nullable(),
  visibility: visibilitySchema,
  severityFloor: severitySchema,
  state: incidentStateSchema,
  failedReason: z.string().max(1000).nullable().default(null),
});

export type IncidentContext = z.infer<typeof incidentContextSchema>;
