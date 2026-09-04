import {
  CreateIncidentInput,
  CreateIncidentSchema,
  IncidentState,
  IncidentVisibility,
  UPLOAD_LIMITS,
} from '@/contracts/reporting';
import { runTriageAgent } from '@/server/agents/triage';
import { TriageResult } from '@/contracts/triage';

export interface IncidentRecord {
  id: string;
  institutionId: string;
  reporterId: string;
  reportingScope: 'cr' | 'student' | 'transport' | 'club';
  scopeContext?: Record<string, unknown>;
  category: string;
  categorySuggestion: string;
  description: string;
  locationId: string | null;
  locationText: string;
  visibility: IncidentVisibility;
  isConfidential: boolean;
  state: IncidentState;
  version: number;
  voteCount: number;
  attachments: Array<{
    storageKey: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
  }>;
  triageResult?: TriageResult;
  clarificationRequest?: {
    question: string;
    missingFields: string[];
    answeredAt?: string;
    answer?: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface QueuedJob {
  id: string;
  incidentId: string;
  type: 'triage' | 'plan_generation' | 'clarification_wait' | 'supervisor_alert';
  status: 'queued' | 'running' | 'succeeded';
  dueAt: string;
}

// In-memory rate limiting store (backed by Redis/Postgres in prod)
const reportRateLimitStore = new Map<string, number[]>();

export function checkAndIncrementReportRateLimit(
  memberId: string,
  nowMs: number = Date.now()
): { allowed: boolean; remaining: number } {
  const oneHourAgo = nowMs - 60 * 60 * 1000;
  const timestamps = reportRateLimitStore.get(memberId) || [];
  const recentTimestamps = timestamps.filter((t) => t > oneHourAgo);

  if (recentTimestamps.length >= UPLOAD_LIMITS.maxNormalReportsPerHour) {
    return { allowed: false, remaining: 0 };
  }

  recentTimestamps.push(nowMs);
  reportRateLimitStore.set(memberId, recentTimestamps);
  return {
    allowed: true,
    remaining: UPLOAD_LIMITS.maxNormalReportsPerHour - recentTimestamps.length,
  };
}

export function resetRateLimitsForTesting() {
  reportRateLimitStore.clear();
}

// Mock incident repository for tests and development
export class IncidentRepository {
  private static incidents: Map<string, IncidentRecord> = new Map();
  private static jobs: QueuedJob[] = [];

  static clear() {
    this.incidents.clear();
    this.jobs = [];
  }

  static async saveIncident(incident: IncidentRecord): Promise<IncidentRecord> {
    this.incidents.set(incident.id, incident);
    return incident;
  }

  static async getIncidentById(id: string): Promise<IncidentRecord | null> {
    return this.incidents.get(id) || null;
  }

  static async listIncidents(institutionId: string, viewerMembershipId?: string): Promise<IncidentRecord[]> {
    return Array.from(this.incidents.values()).filter((inc) => {
      if (inc.institutionId !== institutionId) return false;
      // Confidential incidents only visible to reporter (unless authorized admin)
      if (inc.isConfidential || inc.visibility === 'confidential') {
        return viewerMembershipId ? inc.reporterId === viewerMembershipId : false;
      }
      return true;
    });
  }

  static async enqueueJob(job: QueuedJob): Promise<QueuedJob> {
    this.jobs.push(job);
    return job;
  }

  static getJobs(): QueuedJob[] {
    return [...this.jobs];
  }
}

/**
 * Service to handle safe incident reporting intake, validation,
 * rate limiting, triage AI invocation, and job queuing.
 */
export async function createIncident(
  reporterMembershipId: string,
  input: CreateIncidentInput,
  options: {
    knownLocations?: Array<{ id: string; label: string; kind: string }>;
    skipRateLimit?: boolean;
    nowMs?: number;
  } = {}
): Promise<{ incident: IncidentRecord; job: QueuedJob; rateLimitRemaining: number }> {
  // 1. Schema validation
  const validated = CreateIncidentSchema.parse(input);

  // 2. Rate limit enforcement
  let rateLimitRemaining = UPLOAD_LIMITS.maxNormalReportsPerHour;
  if (!options.skipRateLimit && !validated.isConfidential) {
    const rateCheck = checkAndIncrementReportRateLimit(reporterMembershipId, options.nowMs);
    if (!rateCheck.allowed) {
      throw new Error('Rate limit exceeded: Maximum 5 normal reports per hour allowed.');
    }
    rateLimitRemaining = rateCheck.remaining;
  }

  const incidentId = crypto.randomUUID();
  const nowIso = new Date(options.nowMs || Date.now()).toISOString();

  // 3. Trigger Triage Agent to classify untrusted content
  const { result: triageResult } = await runTriageAgent({
    incidentId,
    institutionId: validated.institutionId,
    description: validated.description,
    locationText: validated.locationText,
    locationId: validated.locationId,
    categorySuggestion: validated.categorySuggestion,
    hasPhotos: validated.attachments.length > 0,
    knownLocations: options.knownLocations,
  });

  // Determine initial state based on triage
  let initialState: IncidentState = 'reported';
  if (triageResult.clarification?.needed) {
    initialState = 'needs_clarification';
  } else {
    initialState = 'triaging';
  }

  const incident: IncidentRecord = {
    id: incidentId,
    institutionId: validated.institutionId,
    reporterId: reporterMembershipId,
    reportingScope: validated.reportingScope,
    scopeContext: validated.scopeContext,
    category: triageResult.category,
    categorySuggestion: validated.categorySuggestion || 'other',
    description: validated.description,
    locationId: triageResult.locationId || validated.locationId || null,
    locationText: validated.locationText,
    visibility: validated.visibility,
    isConfidential: validated.isConfidential,
    state: initialState,
    version: 1,
    voteCount: 0,
    attachments: validated.attachments,
    triageResult,
    clarificationRequest: triageResult.clarification
      ? {
          question: triageResult.clarification.question,
          missingFields: triageResult.clarification.missingFields,
        }
      : null,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  await IncidentRepository.saveIncident(incident);

  // 4. Enqueue Orchestration Job
  const job: QueuedJob = {
    id: crypto.randomUUID(),
    incidentId,
    type: triageResult.clarification?.needed ? 'clarification_wait' : 'plan_generation',
    status: 'queued',
    dueAt: nowIso,
  };

  await IncidentRepository.enqueueJob(job);

  return { incident, job, rateLimitRemaining };
}
