import { NextRequest } from 'next/server';
import { jsonSuccess, jsonError } from '@/server/http-envelope';
import { submitClarificationAnswer } from '@/server/reporting/clarification-service';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const memberId = req.headers.get('x-member-id');

    if (!memberId) {
      return jsonError('UNAUTHENTICATED', 'Missing member context', 401);
    }

    const body = await req.json();

    if (!body.answer || typeof body.answer !== 'string' || body.answer.trim().length < 2) {
      return jsonError('VALIDATION_ERROR', 'A valid answer is required', 422);
    }

    if (typeof body.expectedVersion !== 'number') {
      return jsonError('VALIDATION_ERROR', 'expectedVersion is required for concurrency control', 422);
    }

    const result = await submitClarificationAnswer(memberId, {
      incidentId: id,
      expectedVersion: body.expectedVersion,
      answer: body.answer.trim(),
      updatedLocationText: body.updatedLocationText,
      additionalAttachments: body.additionalAttachments,
    });

    return jsonSuccess({ incident: result.incident, job: result.job });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error submitting clarification';
    if (message.includes('Version mismatch')) {
      return jsonError('CONFLICT', message, 409);
    }
    if (message.includes('Unauthorized')) {
      return jsonError('FORBIDDEN', message, 403);
    }
    return jsonError('SERVER_ERROR', message, 500);
  }
}
