import { randomUUID } from "node:crypto";
import { fail, ok } from "@/contracts/http";
import { getServerEnv } from "@/server/env";
import { createProductionWorker } from "@/server/orchestration/production-worker";
import { secretMatches } from "@/server/security/secrets";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  const requestId = request.headers.get("x-request-id") ?? randomUUID();
  const env = getServerEnv();
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!secretMatches(supplied, env.AUTOMATION_SECRET)) {
    return fail("UNAUTHORIZED_AUTOMATION", "Automation credential is invalid", requestId, 401);
  }
  try {
    const result = await createProductionWorker().tick(`http-${requestId}`);
    return ok(result, requestId);
  } catch (error) {
    return fail("AUTOMATION_FAILED", error instanceof Error ? error.message : "Automation failed", requestId, 500);
  }
}
