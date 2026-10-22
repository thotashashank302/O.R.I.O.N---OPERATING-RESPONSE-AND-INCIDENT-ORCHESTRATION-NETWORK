import { createServiceClient } from "@/server/db/client";
import type { Assignment, AssignmentActionRequest } from "@/contracts/operations";
import { throwPersistenceError } from "@/server/reporting/persistence-errors";

/** The transaction is authoritative, including on a lost/uncertain response. */
export async function performAssignmentAction(assignmentId: string, membershipId: string, request: AssignmentActionRequest): Promise<Assignment> {
  const db = await createServiceClient();
  const { data, error } = await db.rpc("orion_assignment_action", {
    target_id: assignmentId, actor_id: membershipId, expected_version: request.expected_version,
    requested_action: request.action, reason: request.reason ?? request.block_reason ?? undefined,
  });
  if (error) throwPersistenceError(error);
  if (!data) throwPersistenceError({ message: "Assignment transaction returned no result" });
  return data as unknown as Assignment;
}
