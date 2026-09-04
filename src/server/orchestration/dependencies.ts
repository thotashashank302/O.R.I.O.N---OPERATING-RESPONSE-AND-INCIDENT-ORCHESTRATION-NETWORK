import type { PlanTask } from "@/contracts/agents";

export function validateTaskGraph(tasks: readonly PlanTask[]): void {
  const ids = new Set(tasks.map((task) => task.localId));
  if (ids.size !== tasks.length) throw new Error("Task local IDs must be unique");
  for (const task of tasks) {
    if (task.dependsOn.includes(task.localId)) throw new Error("A task cannot depend on itself");
    if (!task.dependsOn.every((id) => ids.has(id))) throw new Error("Task dependency references an unknown task");
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const byId = new Map(tasks.map((task) => [task.localId, task]));
  const visit = (id: string) => {
    if (visiting.has(id)) throw new Error("Task dependency graph contains a cycle");
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of byId.get(id)?.dependsOn ?? []) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of ids) visit(id);
}
