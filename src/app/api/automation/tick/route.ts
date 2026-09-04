import { randomUUID } from "node:crypto";
import { fail, ok } from "@/contracts/http";
import { getServerEnv } from "@/server/env";
import { createProductionWorker } from "@/server/orchestration/production-worker";
import { secretMatches } from "@/server/security/secrets";

export const runtime = "nodejs";
export const maxDuration = 60;

function isAuthorized(request: Request): boolean {
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!supplied) return false;
  const env = getServerEnv();
  if (secretMatches(supplied, env.AUTOMATION_SECRET)) return true;
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && secretMatches(supplied, cronSecret)) return true;
  return false;
}

async function handleTick(request: Request) {
  const requestId = request.headers.get("x-request-id") ?? randomUUID();
  if (!isAuthorized(request)) {
    return fail("UNAUTHORIZED_AUTOMATION", "Automation credential is invalid", requestId, 401);
  }
  try {
    const result = await createProductionWorker().tick(`http-${requestId}`);
    return ok(result, requestId);
  } catch (error) {
    return fail("AUTOMATION_FAILED", error instanceof Error ? error.message : "Automation failed", requestId, 500);
  }
}

// Vercel Cron sends GET requests
export const GET = handleTick;
// Manual/external triggers use POST
export const POST = handleTick;
