import { randomUUID } from "node:crypto";
import { fail, ok } from "@/contracts/http";
import { isAutomationAuthorized } from "@/server/orchestration/automation-auth";
import { createSupabaseAdmin } from "@/server/db/supabase-admin";
import { createProductionWorker } from "@/server/orchestration/production-worker";


export const runtime = "nodejs";
export const maxDuration = 300;

async function handleTick(request: Request) {
  const requestId = request.headers.get("x-request-id") ?? randomUUID();
  let authorized = false;
  try {
    if (!isAutomationAuthorized(request)) {
      return fail("UNAUTHORIZED_AUTOMATION", "Automation credential is invalid", requestId, 401);
    }
    authorized = true;
    const result = await createProductionWorker().tick(`http-${requestId}`);
    const heartbeat = await createSupabaseAdmin().rpc("orion_record_tick", { failed: false });
    if (heartbeat.error) console.error("[automation.heartbeat]", heartbeat.error);
    return ok(result, requestId);
  } catch (error) {
    if (authorized) {
      try { await createSupabaseAdmin().rpc("orion_record_tick", { failed: true }); }
      catch { /* The health endpoint also detects an unavailable database. */ }
    }
    console.error("[automation.tick]", { requestId, error });
    return fail("AUTOMATION_FAILED", "Automation tick failed", requestId, 500);
  }
}

// Vercel Cron sends GET requests
export const GET = handleTick;
// Manual/external triggers use POST
export const POST = handleTick;

