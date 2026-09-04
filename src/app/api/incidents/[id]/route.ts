import { NextRequest } from 'next/server';
import { jsonSuccess, jsonError } from '@/server/http-envelope';
import { requireRequestContext } from '@/server/auth/request-context';
import { getPersistentIncident } from '@/server/reporting/persistent-service';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(req);

    const incident = await getPersistentIncident(context, id);
    if (!incident) {
      return jsonError('NOT_FOUND', 'Incident not found', 404);
    }

    return jsonSuccess({ incident: { ...incident, isReporter: incident.reporterId === context.membershipId } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error retrieving incident';
    return jsonError('SERVER_ERROR', message, 500);
  }
}
