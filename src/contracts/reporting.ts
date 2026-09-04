import { z } from 'zod';

export const INCIDENT_CATEGORIES = [
  'classroom_infrastructure',
  'lab_equipment',
  'washroom_hygiene',
  'electrical_safety',
  'transport_route',
  'club_facility',
  'hostel_maintenance',
  'campus_emergency',
  'confidential_complaint',
  'other',
] as const;

export type IncidentCategory = (typeof INCIDENT_CATEGORIES)[number];

export const INCIDENT_VISIBILITY = [
  'routine',
  'confidential',
  'transport',
  'club',
] as const;

export type IncidentVisibility = (typeof INCIDENT_VISIBILITY)[number];

export const INCIDENT_SEVERITY = [
  'low',
  'medium',
  'high',
  'critical',
] as const;

export type IncidentSeverity = (typeof INCIDENT_SEVERITY)[number];

export const INCIDENT_STATE = [
  'reported',
  'triaging',
  'needs_clarification',
  'planned',
  'awaiting_approval',
  'assigned',
  'acknowledged',
  'in_progress',
  'submitted_for_verification',
  'resolved',
  'reopened',
  'escalated',
  'cancelled',
] as const;

export type IncidentState = (typeof INCIDENT_STATE)[number];

export const UPLOAD_LIMITS = {
  maxFilesPerReport: 3,
  maxSizeBytes: 5 * 1024 * 1024, // 5 MB
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'] as const,
  maxNormalReportsPerHour: 5,
  maxVotesPerMinute: 30,
  maxFileAttemptsPerHour: 10,
};

export const AttachmentSchema = z.object({
  storageKey: z.string().min(5),
  fileName: z.string().min(1).max(255),
  fileSize: z.number().max(UPLOAD_LIMITS.maxSizeBytes, 'File exceeds 5MB limit'),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
});

export type Attachment = z.infer<typeof AttachmentSchema>;

export const CreateIncidentSchema = z.object({
  institutionId: z.string().uuid(),
  categorySuggestion: z.enum(INCIDENT_CATEGORIES).optional().default('other'),
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters')
    .max(2000, 'Description must not exceed 2000 characters')
    .trim(),
  locationId: z.string().uuid().nullable().optional(),
  locationText: z
    .string()
    .min(2, 'Location detail is required')
    .max(200, 'Location detail too long')
    .trim(),
  visibility: z.enum(INCIDENT_VISIBILITY).default('routine'),
  isConfidential: z.boolean().default(false),
  reportingScope: z.enum(['cr', 'student', 'transport', 'club']).default('student'),
  scopeContext: z
    .object({
      departmentId: z.string().uuid().optional(),
      routeId: z.string().optional(),
      clubId: z.string().optional(),
    })
    .optional(),
  attachments: z
    .array(AttachmentSchema)
    .max(UPLOAD_LIMITS.maxFilesPerReport, 'Maximum 3 photos allowed')
    .default([]),
});

export type CreateIncidentInput = z.input<typeof CreateIncidentSchema>;

export const IncidentVoteSchema = z.object({
  incidentId: z.string().uuid(),
  expectedVersion: z.number().int().positive().optional(),
});

export type IncidentVoteInput = z.infer<typeof IncidentVoteSchema>;

export const ReporterConfirmationSchema = z.object({
  incidentId: z.string().uuid(),
  decision: z.enum(['accepted', 'rejected']),
  reason: z.string().min(5, 'A clear reason is required').max(1000).trim(),
  evidenceVersion: z.number().int().nonnegative(),
  expectedVersion: z.number().int().positive(),
});

export type ReporterConfirmationInput = z.infer<typeof ReporterConfirmationSchema>;
