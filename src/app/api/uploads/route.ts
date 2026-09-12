import { UploadRequestSchema } from '@/contracts/reporting';
import { NextRequest } from 'next/server';
import { jsonSuccess, jsonError } from '@/server/http-envelope';
import { authorizePrivateUpload } from '@/server/reporting/upload-service';
import { requireRequestContext, authorizationFailure } from '@/server/auth/request-context';

export async function POST(req: NextRequest) {
  try {
    const context = await requireRequestContext(req);

    const parsed = UploadRequestSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return jsonError('VALIDATION_ERROR', 'A valid image name, integer size (1 byte to 5MB), and MIME type are required', 422);
    const ticket = await authorizePrivateUpload({
      ...parsed.data, institutionId: context.institutionId, memberId: context.membershipId,
    });

    return jsonSuccess(ticket, 201);
  } catch (err: unknown) {
    const authFailure = authorizationFailure(err);
    if (authFailure) return authFailure;
    const message = err instanceof Error ? err.message : 'Upload authorization failed';
    if (message.includes('rate limit exceeded')) {
      return jsonError('RATE_LIMITED', message, 429);
    }
    if (message.includes('Invalid file type') || message.includes('exceeds the 5MB')) {
      return jsonError('VALIDATION_ERROR', message, 422);
    }
    return jsonError('SERVER_ERROR', message, 500);
  }
}
