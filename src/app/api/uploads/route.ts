import { NextRequest } from 'next/server';
import { jsonSuccess, jsonError } from '@/server/http-envelope';
import { authorizePrivateUpload } from '@/server/reporting/upload-service';

export async function POST(req: NextRequest) {
  try {
    const institutionId = req.headers.get('x-institution-id');
    const memberId = req.headers.get('x-member-id');

    if (!institutionId || !memberId) {
      return jsonError('UNAUTHENTICATED', 'Missing institution or member context', 401);
    }

    const body = await req.json();

    if (!body.fileName || !body.fileSize || !body.mimeType) {
      return jsonError('VALIDATION_ERROR', 'fileName, fileSize, and mimeType are required', 422);
    }

    const ticket = await authorizePrivateUpload({
      institutionId,
      memberId,
      fileName: body.fileName,
      fileSize: Number(body.fileSize),
      mimeType: body.mimeType,
      incidentId: body.incidentId,
    });

    return jsonSuccess(ticket, 201);
  } catch (err: unknown) {
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
