import { z } from 'zod';
import { INCIDENT_CATEGORIES } from './reporting';

export const ClarificationRequestSchema = z.object({
  needed: z.boolean(),
  question: z.string().min(5),
  missingFields: z.array(z.string()).min(1),
});

export type ClarificationRequest = z.infer<typeof ClarificationRequestSchema>;

export const TriageResultSchema = z.object({
  category: z.enum(INCIDENT_CATEGORIES),
  secondaryRisks: z.array(z.string()),
  locationId: z.string().uuid().nullable(),
  impactSummary: z.string().min(5).max(500),
  confidence: z.number().min(0).max(1),
  clarification: ClarificationRequestSchema.nullable(),
  duplicateCandidateIds: z.array(z.string()),
});

export type TriageResult = z.infer<typeof TriageResultSchema>;

export interface TriageInputContext {
  incidentId: string;
  institutionId: string;
  description: string;
  locationText: string;
  locationId?: string | null;
  categorySuggestion?: string;
  hasPhotos?: boolean;
  knownLocations?: Array<{ id: string; label: string; kind: string }>;
  recentIncidents?: Array<{ id: string; category: string; description: string; locationText: string }>;
}
