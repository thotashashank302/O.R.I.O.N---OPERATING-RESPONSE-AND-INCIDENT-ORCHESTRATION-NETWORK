import { createServiceClient } from "@/server/db/client";
import type { Assignment, AssignmentActionRequest } from "@/contracts/operations";
import { enqueueCommanderJob } from "@/server/orchestration/commander-enqueue";

export async function performAssignmentAction(assignmentId: string, membershipId: string, request: AssignmentActionRequest): Promise<Assignment> {
  const db = await createServiceClient();
  const { data, error } = await db.rpc("orion_assignment_action", {
    target_id: assignmentId, actor_id: membershipId, expected_version: request.expected_version,
    requested_action: request.action, reason: request.reason ?? request.block_reason ?? undefined,
  });
  if (error) throw Object.assign(new Error(error.message), {
    status: /Stale/.test(error.message) ? 409 : /authorized|not found/.test(error.message) ? 404 : 422,
  });
  const assignment = data as unknown as Assignment;
  if (request.action === "handover" || request.action === "block") {
    const { data: task } = await db.from("incident_tasks").select("plan_id").eq("id", assignment.task_id).single();
    const { data: plan } = await db.from("incident_plans").select("incident_id").eq("id", task!.plan_id).single();
    await enqueueCommanderJob(plan!.incident_id, request.reason ?? request.block_reason ?? "Staff requested handover", "handover-" + assignment.id + "-v" + assignment.version);
  }
  return assignment;
}
