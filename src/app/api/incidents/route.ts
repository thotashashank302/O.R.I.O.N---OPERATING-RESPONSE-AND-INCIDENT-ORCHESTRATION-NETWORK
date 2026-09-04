import { NextRequest } from 'next/server';
import { jsonSuccess, jsonError } from '@/server/http-envelope';
import { CreateIncidentSchema } from '@/contracts/reporting';
import { requireRequestContext } from '@/server/auth/request-context';
import { createPersistentIncident, listPersistentIncidents } from '@/server/reporting/persistent-service';
import { createProductionWorker } from '@/server/orchestration/production-worker';

export async function GET(req: NextRequest) {
  try {
    const context = await requireRequestContext(req);

    const incidents = await listPersistentIncidents(context);
    return jsonSuccess({ incidents });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch incidents';
    return jsonError('SERVER_ERROR', message, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const context = await requireRequestContext(req, ['student', 'cr', 'president', 'coordinator']);

    const body = await req.json();

    const payload = {
      ...body,
      institutionId: context.institutionId,
    };

    const validated = CreateIncidentSchema.safeParse(payload);
    if (!validated.success) {
      return jsonError('VALIDATION_ERROR', validated.error.message, 422);
    }

    const result = await createPersistentIncident(context, validated.data);

    // Fire-and-forget: immediately process the queued Commander job
    // so the plan/assignment/email chain starts without waiting for the cron
    if (result.job) {
      createProductionWorker().tick(`inline-${result.incident.id}`).catch((err) => {
        console.error('[ORION] Inline tick failed (cron will retry):', err);
      });
    }

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
