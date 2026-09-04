import { NextRequest } from 'next/server';
import { jsonSuccess, jsonError } from '@/server/http-envelope';
import { castVote, removeVote } from '@/server/reporting/voting-service';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const memberId = req.headers.get('x-member-id');
    const institutionId = req.headers.get('x-institution-id');

    if (!memberId || !institutionId) {
      return jsonError('UNAUTHENTICATED', 'Missing member or institution context', 401);
    }

    const result = await castVote(id, { id: memberId, institutionId });
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
    const memberId = req.headers.get('x-member-id');
    const institutionId = req.headers.get('x-institution-id');

    if (!memberId || !institutionId) {
      return jsonError('UNAUTHENTICATED', 'Missing member or institution context', 401);
    }

    const result = await removeVote(id, { id: memberId, institutionId });
    return jsonSuccess(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to remove vote';
    return jsonError('SERVER_ERROR', message, 500);
  }
}
