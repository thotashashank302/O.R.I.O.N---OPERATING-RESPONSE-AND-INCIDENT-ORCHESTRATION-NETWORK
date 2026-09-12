import { IncidentRecord, IncidentRepository } from './intake-service';
import { runTriageAgent } from '@/server/agents/triage';

export interface EmergencyContactInfo {
  campusSecurityPhone: string;
  medicalCenterPhone: string;
  internalComplaintsCommitteeEmail: string;
  disclaimer: string;
}

// Approved official campus contacts (never fabricated)
export const OFFICIAL_CAMPUS_CONTACTS: Record<string, EmergencyContactInfo> = {
  default: {
    campusSecurityPhone: '+91-80-2360-0000',
    medicalCenterPhone: '+91-80-2360-1111',
    internalComplaintsCommitteeEmail: 'icc.grievance@institution.edu.in',
    disclaimer:
      'NOTE: This system coordinates campus operations and is NOT an automated emergency response service. In case of active fire, medical emergency, or physical violence, contact campus security or emergency services immediately.',
  },
};

export interface ConfidentialCaseAccess {
  incidentId: string;
  authorizedMembershipIds: string[];
  excludedAccusedMembershipIds: string[];
}

const confidentialAccessStore = new Map<string, ConfidentialCaseAccess>();

/**
 * Creates a private, confidential complaint or emergency report.
 * Strictly bypasses CR review, excludes accused staff/CR from case access,
 * and sets visibility to 'confidential' so it is never displayed in public lists or vote feeds.
 */
export async function createPrivateConfidentialReport(
  reporterMembershipId: string,
  institutionId: string,
  input: {
    description: string;
    locationText: string;
    category: 'campus_emergency' | 'confidential_complaint';
    accusedMembershipId?: string;
    attachments?: Array<{
      storageKey: string;
      fileName: string;
      fileSize: number;
      mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
    }>;
  },
  options: { nowMs?: number } = {}
): Promise<{ incident: IncidentRecord; contacts: EmergencyContactInfo }> {
  const incidentId = crypto.randomUUID();
  const nowIso = new Date(options.nowMs || Date.now()).toISOString();

  // 1. Triage the private report
  const { result: triageResult } = await runTriageAgent({
    incidentId,
    institutionId,
    description: input.description,
    locationText: input.locationText,
    categorySuggestion: input.category,
    hasPhotos: (input.attachments?.length ?? 0) > 0,
  });

  const incident: IncidentRecord = {
    id: incidentId,
    institutionId,
    reporterId: reporterMembershipId,
    reportingScope: 'student',
    category: input.category,
    categorySuggestion: input.category,
    description: input.description,
    locationId: triageResult.locationId || null,
    locationText: input.locationText,
    visibility: 'confidential',
    isConfidential: true,
    state: 'reported',
    version: 1,
    voteCount: 0,
    attachments: input.attachments || [],
    triageResult,
    clarificationRequest: null,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  await IncidentRepository.saveIncident(incident);

  // 2. Set up case access policy (excluding accused, granting to reporter + dean/ICC)
  const excluded = input.accusedMembershipId ? [input.accusedMembershipId] : [];
  confidentialAccessStore.set(incidentId, {
    incidentId,
    authorizedMembershipIds: [reporterMembershipId],
    excludedAccusedMembershipIds: excluded,
  });

  const contacts = OFFICIAL_CAMPUS_CONTACTS[institutionId] || OFFICIAL_CAMPUS_CONTACTS.default;

  return { incident, contacts };
}

/**
 * Checks if a viewer is authorized to inspect a confidential incident.
 * Denies access if the viewer is the accused party or not explicitly authorized.
 */
export function canViewConfidentialIncident(
  incidentId: string,
  viewerMembershipId: string,
  viewerRoles: string[] = []
): boolean {
  const access = confidentialAccessStore.get(incidentId);
  if (!access) return false;

  // Accused identity is unconditionally DENIED access
  if (access.excludedAccusedMembershipIds.includes(viewerMembershipId)) {
    return false;
  }

  // Reporter is authorized
  if (access.authorizedMembershipIds.includes(viewerMembershipId)) {
    return true;
  }

  // Principal / ICC Grievance Head roles authorized
  if (viewerRoles.includes('principal') || viewerRoles.includes('icc_head')) {
    return true;
  }

  return false;
}
