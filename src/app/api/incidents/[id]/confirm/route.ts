import { NextRequest } from 'next/server';
import { jsonSuccess, jsonError } from '@/server/http-envelope';
import { submitReporterConfirmation } from '@/server/reporting/confirmation-service';
import { ReporterConfirmationSchema } from '@/contracts/reporting';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const memberId = req.headers.get('x-member-id');
    const rolesHeader = req.headers.get('x-member-roles') || '';
    const roles = rolesHeader.split(',').filter(Boolean);

    if (!memberId) {
      return jsonError('UNAUTHENTICATED', 'Missing authenticated member context', 401);
    }

    const body = await req.json();
    const validated = ReporterConfirmationSchema.safeParse({
      ...body,
      incidentId: id,
    });

    if (!validated.success) {
      return jsonError('VALIDATION_ERROR', validated.error.message, 422);
    }

    const result = await submitReporterConfirmation(memberId, validated.data, {
      verifierRoles: roles,
    });

    return jsonSuccess({
      incident: result.incident,
      verification: result.verification,
      replanJob: result.job,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error confirming incident resolution';
    if (message.includes('Version mismatch') || message.includes('409 Conflict')) {
      return jsonError('CONFLICT', message, 409);
    }
    if (message.includes('Unauthorized')) {
      return jsonError('FORBIDDEN', message, 403);
    }
    if (message.includes('Invalid incident state')) {
      return jsonError('BAD_REQUEST', message, 400);
    }
    return jsonError('SERVER_ERROR', message, 500);
  }
}
