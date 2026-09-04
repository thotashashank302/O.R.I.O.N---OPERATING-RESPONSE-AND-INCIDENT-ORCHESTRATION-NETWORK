import { NextRequest } from 'next/server';
import { jsonSuccess, jsonError } from '@/server/http-envelope';
import { requireRequestContext } from '@/server/auth/request-context';
import { setPersistentVote } from '@/server/reporting/persistent-service';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(req);

    const result = await setPersistentVote(context, id, true);
    return jsonSuccess(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to cast vote';
    if (message.includes('Rate limit')) {
      return jsonError('RATE_LIMITED', message, 429);
    }
    if (message.includes('strictly excluded') || message.includes('Forbidden')) {
      return jsonError('FORBIDDEN', message, 403);
    }
    if (message.includes('not found')) {
      return jsonError('NOT_FOUND', message, 404);
    }
    return jsonError('SERVER_ERROR', message, 500);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(req);

    const result = await setPersistentVote(context, id, false);
    return jsonSuccess(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to remove vote';
    return jsonError('SERVER_ERROR', message, 500);
  }
}
