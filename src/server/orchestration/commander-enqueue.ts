import { incidentPlanSchema } from "@/contracts/agents";
import { incidentStateSchema, severitySchema, visibilitySchema } from "@/contracts/domain";
import { createSupabaseAdmin } from "@/server/db/supabase-admin";

/** Enqueue the canonical Commander job used for initial planning and replanning. */
export async function enqueueCommanderJob(
  incidentId: string,
  failureReason: string | null = null,
  dedupeSuffix?: string,
) {
  const db = createSupabaseAdmin();
  const { data: incident, error: incidentError } = await db.from("incidents")
    .select("id,institution_id,version,description,category,location_id,visibility,severity,state")
    .eq("id", incidentId)
    .single();
  if (incidentError || !incident) throw new Error("Incident not found for Commander job");

  const [{ data: capabilities }, { data: latestPlan }] = await Promise.all([
    db.from("staff_capabilities").select("skills").eq("institution_id", incident.institution_id),
    db.from("incident_plans")
      .select("id,version,priority,explanation,acknowledgement_minutes")
      .eq("incident_id", incidentId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const eligibleProfiles = [...new Set((capabilities ?? []).flatMap((item) => item.skills ?? []))];
  if (eligibleProfiles.length === 0) {
    await db.from("incident_events").insert({
      institution_id: incident.institution_id,
      incident_id: incident.id,
      actor_type: "system",
      action: "commander_waiting_for_staff_profiles",
      safe_payload: { failure_reason: failureReason },
    });
    return null;
  }

  let priorPlan = null;
  if (latestPlan) {
    const { data: tasks } = await db.from("incident_tasks")
      .select("local_id,logical_task_key,specialist_profile,goal,evidence_requirements,requires_approval")
      .eq("plan_id", latestPlan.id);
    const { data: dependencies } = await db.from("task_dependencies")
      .select("task_id,prerequisite_task_id")
      .eq("institution_id", incident.institution_id);
    const { data: taskIds } = await db.from("incident_tasks").select("id,local_id").eq("plan_id", latestPlan.id);
    const localById = new Map((taskIds ?? []).map((task) => [task.id, task.local_id]));
    const depsByTask = new Map<string, string[]>();
    for (const dependency of dependencies ?? []) {
      if (!localById.has(dependency.task_id) || !localById.has(dependency.prerequisite_task_id)) continue;
      const list = depsByTask.get(dependency.task_id) ?? [];
      list.push(localById.get(dependency.prerequisite_task_id)!);
      depsByTask.set(dependency.task_id, list);
    }
    priorPlan = incidentPlanSchema.parse({
      priority: latestPlan.priority,
      explanation: latestPlan.explanation,
      specialists: [...new Set((tasks ?? []).map((task) => task.specialist_profile))],
      tasks: (tasks ?? []).map((task) => ({
        localId: task.local_id,
        logicalTaskKey: task.logical_task_key,
        profile: task.specialist_profile,
        goal: task.goal,
        dependsOn: depsByTask.get((taskIds ?? []).find((item) => item.local_id === task.local_id)?.id ?? "") ?? [],
        evidencePolicy: task.evidence_requirements,
        requiresApproval: task.requires_approval,
      })),
      acknowledgementMinutes: latestPlan.acknowledgement_minutes,
    });
  }

  const payload = {
    incident: {
      id: incident.id,
      institutionId: incident.institution_id,
      version: incident.version,
      planVersion: latestPlan?.version ?? 0,
      description: incident.description,
      category: incident.category,
      locationId: incident.location_id,
      visibility: visibilitySchema.parse(incident.visibility),
      severityFloor: severitySchema.parse(incident.severity),
      state: incidentStateSchema.parse(incident.state),
      failedReason: failureReason,
    },
    eligibleProfiles,
    priorPlan,
    failureReason,
  };
  const { data, error } = await db.from("jobs").insert({
    institution_id: incident.institution_id,
    incident_id: incident.id,
    type: "commander",
    dedupe_key: `commander:${incident.id}:v${incident.version}:${dedupeSuffix ?? "plan"}`,
    payload,
  }).select("id").single();
  if (error) throw error;
  return data;
}
