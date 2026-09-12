import { jsonError } from '@/server/http-envelope';

export class WorkflowPersistenceError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number) { super(message); }
}

export function throwPersistenceError(error: { code?: string; message: string }): never {
  if (error.code === '42501') throw new WorkflowPersistenceError('FORBIDDEN', 'This action is not authorized', 403);
  if (error.code === 'P0001' && error.message.includes('Rate limit exceeded')) {
    throw new WorkflowPersistenceError('RATE_LIMITED', 'Maximum 5 normal reports per hour allowed', 429);
  }
  if (error.code === 'P0001' || error.code === '23505') {
    throw new WorkflowPersistenceError('CONFLICT', 'The report changed, the request was already used, or evidence review is incomplete. Refresh before retrying.', 409);
  }
  console.error('[workflow.persistence]', { code: error.code, message: error.message });
  throw new WorkflowPersistenceError('WORKFLOW_UNAVAILABLE', 'The operation could not be confirmed. Retry with the same request.', 503);
}

export function workflowFailure(error: unknown): Response | null {
  return error instanceof WorkflowPersistenceError ? jsonError(error.code, error.message, error.status) : null;
}
