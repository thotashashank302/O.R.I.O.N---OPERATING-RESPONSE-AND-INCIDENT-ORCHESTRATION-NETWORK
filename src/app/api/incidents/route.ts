import { NextRequest } from 'next/server';
import { jsonSuccess, jsonError } from '@/server/http-envelope';
import { createIncident, IncidentRepository } from '@/server/reporting/intake-service';
import { createPrivateConfidentialReport } from '@/server/reporting/private-intake-service';
import { CreateIncidentSchema } from '@/contracts/reporting';

export async function GET(req: NextRequest) {
  try {
    const institutionId = req.headers.get('x-institution-id');
    const memberId = req.headers.get('x-member-id');

    if (!institutionId) {
      return jsonError('UNAUTHENTICATED', 'Missing institution context', 401);
    }

    const incidents = await IncidentRepository.listIncidents(institutionId, memberId || undefined);
    return jsonSuccess({ incidents });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch incidents';
    return jsonError('SERVER_ERROR', message, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const institutionId = req.headers.get('x-institution-id');
    const memberId = req.headers.get('x-member-id');

    if (!institutionId || !memberId) {
      return jsonError('UNAUTHENTICATED', 'Authentication and institution context required', 401);
    }

    const body = await req.json();

    // Check if confidential / emergency
    if (body.isConfidential || body.visibility === 'confidential') {
      const result = await createPrivateConfidentialReport(memberId, institutionId, {
        description: body.description,
        locationText: body.locationText,
        category: body.category === 'campus_emergency' ? 'campus_emergency' : 'confidential_complaint',
        accusedMembershipId: body.accusedMembershipId,
        attachments: body.attachments,
      });
      return jsonSuccess({ incident: result.incident, emergencyContacts: result.contacts }, 201);
    }

    // Normal routine reporting
    const payload = {
      ...body,
      institutionId,
    };

    const validated = CreateIncidentSchema.safeParse(payload);
    if (!validated.success) {
      return jsonError('VALIDATION_ERROR', validated.error.message, 422);
    }

    const result = await createIncident(memberId, validated.data);
    return jsonSuccess(
      {
        incident: result.incident,
        job: result.job,
        rateLimitRemaining: result.rateLimitRemaining,
      },
      201
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create incident';
    if (message.includes('Rate limit exceeded')) {
      return jsonError('RATE_LIMITED', message, 429);
    }
    return jsonError('SERVER_ERROR', message, 500);
  }
}
