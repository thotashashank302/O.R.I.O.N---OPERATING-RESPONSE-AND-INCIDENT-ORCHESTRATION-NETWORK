import { isAutomationAuthorized } from "@/server/orchestration/automation-auth";
import { createSupabaseAdmin } from "@/server/db/supabase-admin";
export async function GET(request: Request) {
  if (!isAutomationAuthorized(request)) return Response.json({ error: { message: "Automation credential required" } }, { status: 401 });
  try {
    const { data, error } = await createSupabaseAdmin().rpc("orion_automation_health");
    if (error) throw error;
    const health = data as { overdue_seconds: number; dead_jobs: number; expired_leases: number; seconds_since_tick: number | null; last_tick_failed: boolean };
    const healthy = health.overdue_seconds <= 120 && health.dead_jobs === 0 && health.expired_leases === 0 && health.seconds_since_tick !== null && health.seconds_since_tick <= 120 && !health.last_tick_failed;
    return Response.json({ data: { ...health, healthy } }, { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: { message: "Automation health unavailable" } }, { status: 503 });
  }
}
