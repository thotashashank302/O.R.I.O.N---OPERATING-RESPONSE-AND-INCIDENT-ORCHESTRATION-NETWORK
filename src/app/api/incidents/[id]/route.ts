import { NextRequest } from 'next/server';
import { jsonSuccess, jsonError } from '@/server/http-envelope';
import { IncidentRepository } from '@/server/reporting/intake-service';
import { canViewConfidentialIncident } from '@/server/reporting/private-intake-service';
import { hasMemberVoted } from '@/server/reporting/voting-service';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const memberId = req.headers.get('x-member-id');
    const institutionId = req.headers.get('x-institution-id');
    const rolesHeader = req.headers.get('x-member-roles') || '';
    const roles = rolesHeader.split(',').filter(Boolean);

    const incident = await IncidentRepository.getIncidentById(id);
    if (!incident) {
      return jsonError('NOT_FOUND', 'Incident not found', 404);
    }

    if (institutionId && incident.institutionId !== institutionId) {
      return jsonError('FORBIDDEN', 'Access denied to cross-institution incident', 403);
    }

    // Confidentiality gate
    if (incident.isConfidential || incident.visibility === 'confidential') {
      if (!memberId || !canViewConfidentialIncident(incident.id, memberId, roles)) {
        return jsonError('NOT_FOUND', 'Inaccessible resource', 404);
      }
    }

    const hasVoted = memberId ? hasMemberVoted(incident.id, memberId) : false;

    // Safe projection: do NOT leak voter list or internal secrets
    const safeProjection = {
      id: incident.id,
      institutionId: incident.institutionId,
      category: incident.category,
      description: incident.description,
      locationText: incident.locationText,
      visibility: incident.visibility,
      isConfidential: incident.isConfidential,
      state: incident.state,
      version: incident.version,
      voteCount: incident.voteCount,
      hasVoted,
      clarificationRequest: incident.clarificationRequest,
      triageSummary: incident.triageResult?.impactSummary,
      attachmentsCount: incident.attachments.length,
      createdAt: incident.createdAt,
      updatedAt: incident.updatedAt,
      isReporter: memberId ? incident.reporterId === memberId : false,
    };

    return jsonSuccess({ incident: safeProjection });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error retrieving incident';
    return jsonError('SERVER_ERROR', message, 500);
  }
}
