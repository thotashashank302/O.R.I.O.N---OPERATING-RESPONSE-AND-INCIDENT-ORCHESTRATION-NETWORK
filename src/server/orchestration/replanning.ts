import type { PlanTask } from "@/contracts/agents";

export interface ExistingTaskSnapshot {
  id: string;
  logicalTaskKey: string;
  goal: string;
  locationId: string | null;
  evidencePolicy: string[];
  evidenceVersion: number;
  verified: boolean;
  hasActiveAssignment: boolean;
}

export interface CarryForwardDecision {
  nextTask: PlanTask;
  carriedFromTaskId: string | null;
  carriesVerification: boolean;
  requiresAssignmentReconciliation: boolean;
}

export function planCarryForward(
  prior: readonly ExistingTaskSnapshot[],
  next: readonly (PlanTask & { locationId?: string | null; evidenceVersion?: number })[],
): CarryForwardDecision[] {
  const byKey = new Map(prior.map((task) => [task.logicalTaskKey, task]));
  return next.map((nextTask) => {
    const old = byKey.get(nextTask.logicalTaskKey);
    const unchanged = Boolean(old)
      && old?.goal === nextTask.goal
      && old.locationId === (nextTask.locationId ?? null)
      && old.evidenceVersion === (nextTask.evidenceVersion ?? 1)
      && JSON.stringify([...old.evidencePolicy].sort()) === JSON.stringify([...nextTask.evidencePolicy].sort());
    return {
      nextTask,
      carriedFromTaskId: old?.id ?? null,
      carriesVerification: Boolean(old?.verified && unchanged),
      requiresAssignmentReconciliation: Boolean(old?.hasActiveAssignment && !unchanged),
    };
  });
}
