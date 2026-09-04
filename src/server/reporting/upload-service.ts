import { UPLOAD_LIMITS } from '@/contracts/reporting';
import { createSupabaseAdmin } from '@/server/db/supabase-admin';

export interface UploadAuthorizationRequest {
  institutionId: string;
  memberId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  incidentId?: string;
}

export interface UploadAuthorizationResult {
  uploadUrl: string;
  storageKey: string;
  expiresAt: string;
  maxSizeBytes: number;
}

const fileRateLimitStore = new Map<string, number[]>();

export function checkAndIncrementUploadRateLimit(
  memberId: string,
  nowMs: number = Date.now()
): { allowed: boolean; remaining: number } {
  const oneHourAgo = nowMs - 60 * 60 * 1000;
  const timestamps = fileRateLimitStore.get(memberId) || [];
  const recent = timestamps.filter((t) => t > oneHourAgo);

  if (recent.length >= UPLOAD_LIMITS.maxFileAttemptsPerHour) {
    return { allowed: false, remaining: 0 };
  }

  recent.push(nowMs);
  fileRateLimitStore.set(memberId, recent);
  return {
    allowed: true,
    remaining: UPLOAD_LIMITS.maxFileAttemptsPerHour - recent.length,
  };
}

/**
 * Authorizes a private signed upload ticket.
 * Validates file size, extension, MIME type, and member rate limits.
 */
export async function authorizePrivateUpload(
  request: UploadAuthorizationRequest,
  options: {
    nowMs?: number;
    signUpload?: (storageKey: string) => Promise<string>;
  } = {}
): Promise<UploadAuthorizationResult> {
  // 1. Rate check
  const rate = checkAndIncrementUploadRateLimit(request.memberId, options.nowMs);
  if (!rate.allowed) {
    throw new Error('Upload attempt rate limit exceeded (maximum 10 attempts per hour).');
  }

  // 2. MIME type validation
  if (!(UPLOAD_LIMITS.allowedMimeTypes as readonly string[]).includes(request.mimeType)) {
    throw new Error(`Invalid file type: ${request.mimeType}. Allowed formats: JPEG, PNG, WebP.`);
  }

  // 3. File size validation
  if (request.fileSize > UPLOAD_LIMITS.maxSizeBytes) {
    throw new Error(`File size ${request.fileSize} bytes exceeds the 5MB maximum limit.`);
  }

  // 4. Generate randomized storage key
  const randomSuffix = crypto.randomUUID();
  const sanitizedExt = request.mimeType.split('/')[1] || 'jpg';
  const storageKey = `institutions/${request.institutionId}/incidents/${
    request.incidentId || 'pre-intake'
  }/${Date.now()}_${randomSuffix}.${sanitizedExt}`;

  const expiresAt = new Date((options.nowMs || Date.now()) + 15 * 60 * 1000).toISOString();

  const signUpload = options.signUpload ?? (async (key: string) => {
    const { data, error } = await createSupabaseAdmin().storage
      .from('evidence-vault')
      .createSignedUploadUrl(key);
    if (error || !data?.signedUrl) throw new Error(error?.message ?? 'Unable to authorize private upload');
    return data.signedUrl;
  });
  const uploadUrl = await signUpload(storageKey);

  return {
    uploadUrl,
    storageKey,
    expiresAt,
    maxSizeBytes: UPLOAD_LIMITS.maxSizeBytes,
  };
}
