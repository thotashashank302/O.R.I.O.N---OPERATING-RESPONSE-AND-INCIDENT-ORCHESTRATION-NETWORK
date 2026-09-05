import { verifySubmittedTask } from "./verify-task";
import { randomUUID, createHash } from "node:crypto";
import { z } from "zod";
import { commanderContextSchema } from "./schemas";
import { incidentPlanSchema, type SpecialistAction } from "@/contracts/agents";
import { CommanderAgent } from "@/server/agents/commander";
import { FeatherlessProvider } from "@/server/agents/provider";
import { executeRecorded, type AgentRunStore } from "@/server/agents/runner";
import { SpecialistAgent, specialistContextSchema } from "@/server/agents/specialist";
import { createSupabaseAdmin } from "@/server/db/supabase-admin";
import { deliverOutbox, parseRecipientAllowlist } from "@/server/email/outbox";
import { ResendEmailTransport } from "@/server/email/resend-transport";
import { getEmailDeliveryEnv, getServerEnv } from "@/server/env";
import { DurableJobWorker, type JobRecord } from "./jobs";
import { SupabaseJobStore } from "./supabase-job-store";
import type { Json } from "@/contracts/database";

export function createProductionWorker(): DurableJobWorker {
  const env = getServerEnv();
  const client = createSupabaseAdmin();
  const provider = new FeatherlessProvider({
    apiKey: env.FEATHERLESS_API_KEY,
    baseUrl: env.FEATHERLESS_BASE_URL,
    model: env.FEATHERLESS_MODEL,
    timeoutMs: 90_000,
  });
  const commander = new CommanderAgent(provider);
  const specialist = new SpecialistAgent(provider);
  const runStore: AgentRunStore = {
    async save(record) {
      const { error } = await client.from("agent_runs").insert({
        id: record.runId,
        incident_id: record.incidentId,
        institution_id: record.institutionId,
        agent_name: record.agent,
        provider: record.provider,
        model: record.model,
        prompt_version: record.promptVersion,
        latency_ms: record.latencyMs,
        status: record.status,
        validated_outcome: record.validatedOutcome as Json | undefined,
        safe_error: record.safeError,
      });
      if (error) throw error;
    },
  };

  const handleCommander = async (job: JobRecord) => {
    if (!job.incidentId) throw new Error("Commander job requires an incident");
    const context = commanderContextSchema.parse(job.payload);
    const runId = randomUUID();
    const output = await executeRecorded(commander, {
      runId,
      institutionId: job.institutionId,
      incidentId: job.incidentId,
      incidentVersion: context.incident.version,
      promptVersion: "commander-v1",
      context,
    }, runStore);
    const plan = incidentPlanSchema.parse(output.result);
    const { error: rpcError } = await client.rpc("persist_commander_plan", {
      job_id: job.id,
      expected_incident_version: context.incident.version,
      plan_payload: plan,
      agent_run_id: runId,
    });
    if (rpcError) {
      console.warn("[ORION Commander] RPC persist_commander_plan failed, executing resilient TypeScript persistence:", rpcError.message);
      await persistCommanderPlanFallback(client, job, context.incident.version, plan, runId);
    }
  };

  const handleSpecialist = async (job: JobRecord) => {
    if (!job.incidentId) throw new Error("Specialist job requires an incident");
    const { data, error } = await client.rpc("get_specialist_context", { job_id: job.id });
    if (error) throw new Error(error.message);
    const envelope = specialistContextSchema.extend({ incidentVersion: z.number().int().positive() }).safeParse(data);
    if (!envelope.success) {
      if (envelope.error.issues.some((i) => i.path.includes("eligibleStaff"))) {
        throw new Error("No staff currently available with matching skills for this task. Waiting for staff availability.");
      }
      throw new Error(`Specialist context validation failed: ${envelope.error.message}`);
    }
    const { incidentVersion, ...context } = envelope.data;
    const runId = randomUUID();
    const output = await executeRecorded(specialist, {
      runId,
      institutionId: job.institutionId,
      incidentId: job.incidentId,
      incidentVersion,
      promptVersion: "specialist-v1",
      context,
    }, runStore);
    const selected = context.eligibleStaff.find((staff) => staff.membershipId === output.result.candidateStaffId);
    if (!selected) throw new Error("Selected staff context disappeared");
    const persisted = await client.rpc("persist_specialist_action", {
      job_id: job.id,
      expected_incident_version: incidentVersion,
      expected_staff_version: selected.capabilityVersion,
      action_payload: output.result,
      agent_run_id: runId,
    });
    if (persisted.error) {
      console.warn("[ORION Specialist] RPC persist_specialist_action failed, executing resilient TypeScript persistence:", persisted.error.message);
      await persistSpecialistActionFallback(client, job, incidentVersion, selected, output.result, runId);
    }
  };

  const handleOutbox = async (job: JobRecord) => {
    const emailEnv = getEmailDeliveryEnv();
    await deliverOutbox(job.payload, client, new ResendEmailTransport(emailEnv.RESEND_API_KEY, emailEnv.RESEND_FROM), {
      appUrl: emailEnv.APP_URL,
      actionSecret: emailEnv.EMAIL_ACTION_SECRET,
      demoMode: emailEnv.DEMO_MODE === "true",
      recipientAllowlist: parseRecipientAllowlist(emailEnv.DEMO_RECIPIENT_ALLOWLIST),
    });
  };

  const payloadId = (job: JobRecord, ...keys: string[]) => {
    for (const key of keys) {
      const value = job.payload[key];
      if (typeof value === "string" && value.length > 0) return value;
    }
    throw new Error(`${job.type} job is missing its target id`);
  };

  const handleAckReminder = async (job: JobRecord) => {
    const assignmentId = payloadId(job, "assignmentId", "assignment_id");
    const { data: assignment, error } = await client.from("assignments")
      .select("id,state,assignee_membership_id")
      .eq("id", assignmentId)
      .eq("institution_id", job.institutionId)
      .maybeSingle();
    if (error) throw error;
    if (!assignment || assignment.state !== "offered") return;
    const { error: notifyError } = await client.from("notifications").insert({
      institution_id: job.institutionId,
      recipient_membership_id: assignment.assignee_membership_id,
      safe_text: "Reminder: an ORION task is waiting for your acknowledgement.",
      link: "/staff#evidence",
    });
    if (notifyError) throw notifyError;
  };

  const notifySupervisors = async (job: JobRecord, safeText: string, action: string) => {
    if (!job.incidentId) throw new Error(`${job.type} job requires an incident`);
    const { data: grants, error } = await client.from("role_grants")
      .select("membership_id")
      .eq("institution_id", job.institutionId)
      .in("role", ["principal", "hod", "supervisor"])
      .is("revoked_at", null);
    if (error) throw error;
    if ((grants ?? []).length > 0) {
      const { error: notifyError } = await client.from("notifications").insert((grants ?? []).map((grant) => ({
        institution_id: job.institutionId,
        recipient_membership_id: grant.membership_id,
        safe_text: safeText,
        link: `/incidents/${job.incidentId}`,
      })));
      if (notifyError) throw notifyError;
    }
    const { error: eventError } = await client.from("incident_events").insert({
      institution_id: job.institutionId,
      incident_id: job.incidentId,
      actor_type: "system",
      action,
      safe_payload: job.payload as Json,
    });
    if (eventError) throw eventError;
  };

  const handleAssignmentEscalation = (job: JobRecord) => notifySupervisors(
    job,
    "An ORION assignment missed its acknowledgement deadline and requires review.",
    "assignment_acknowledgement_escalated",
  );

  const handleVerifierReminder = async (job: JobRecord) => {
    const taskId = payloadId(job, "taskId", "task_id");
    const { data: task, error } = await client.from("incident_tasks")
      .select("id,state,designated_verifier_membership_id")
      .eq("id", taskId)
      .eq("institution_id", job.institutionId)
      .maybeSingle();
    if (error) throw error;
    if (!task || task.state !== "submitted" || !task.designated_verifier_membership_id) return;
    const { error: notifyError } = await client.from("notifications").insert({
      institution_id: job.institutionId,
      recipient_membership_id: task.designated_verifier_membership_id,
      safe_text: "Reminder: an ORION task is awaiting your verification.",
      link: job.incidentId ? `/incidents/${job.incidentId}` : null,
    });
    if (notifyError) throw notifyError;
  };

  const handleVerifierEscalation = (job: JobRecord) => notifySupervisors(
    job,
    "An ORION task missed its verification deadline and requires reassignment.",
    "verification_deadline_escalated",
  );

  return new DurableJobWorker(new SupabaseJobStore(client), {
    verification: verifySubmittedTask,
    commander: handleCommander,
    specialist: handleSpecialist,
    ack_reminder: handleAckReminder,
    assignment_escalation: handleAssignmentEscalation,
    verifier_reminder: handleVerifierReminder,
    verifier_escalation: handleVerifierEscalation,
    outbox_delivery: handleOutbox,
  });
}

async function persistCommanderPlanFallback(
  client: ReturnType<typeof createSupabaseAdmin>,
  job: JobRecord,
  expectedIncidentVersion: number,
  plan: z.infer<typeof incidentPlanSchema>,
  agentRunId: string,
) {
  const incidentId = job.incidentId!;
  const institutionId = job.institutionId;

  const { data: incident, error: incError } = await client.from("incidents")
    .select("id, institution_id, version, plan_version, state")
    .eq("id", incidentId)
    .single();
  if (incError || !incident) throw new Error("Incident not found for Commander plan");
  if (incident.version !== expectedIncidentVersion) throw new Error("Stale incident version");

  await client.from("incident_plans")
    .update({ status: "superseded" })
    .eq("incident_id", incidentId)
    .eq("status", "active");

  const newPlanId = randomUUID();
  const nextPlanVersion = incident.plan_version + 1;

  const { error: planError } = await client.from("incident_plans").insert({
    id: newPlanId,
    institution_id: institutionId,
    incident_id: incidentId,
    version: nextPlanVersion,
    priority: plan.priority,
    explanation: plan.explanation,
    acknowledgement_minutes: plan.acknowledgementMinutes,
    status: "active",
    agent_run_id: agentRunId,
  });
  if (planError) throw new Error(`Failed to insert incident plan: ${planError.message}`);

  const taskMap = new Map<string, string>();
  for (const t of plan.tasks) {
    const taskId = randomUUID();
    taskMap.set(t.localId, taskId);
    const hasDeps = t.dependsOn && t.dependsOn.length > 0;
    const { error: taskError } = await client.from("incident_tasks").insert({
      id: taskId,
      institution_id: institutionId,
      plan_id: newPlanId,
      local_id: t.localId,
      logical_task_key: t.logicalTaskKey,
      specialist_profile: t.profile,
      goal: t.goal,
      evidence_requirements: t.evidencePolicy as unknown as Json,
      requires_approval: t.requiresApproval,
      state: hasDeps ? "pending" : "ready",
      evidence_version: 1,
    });
    if (taskError) throw new Error(`Failed to insert task ${t.localId}: ${taskError.message}`);
  }

  for (const t of plan.tasks) {
    if (!t.dependsOn || t.dependsOn.length === 0) continue;
    const taskId = taskMap.get(t.localId)!;
    for (const dep of t.dependsOn) {
      const prereqId = taskMap.get(dep);
      if (prereqId) {
        await client.from("task_dependencies").insert({
          institution_id: institutionId,
          task_id: taskId,
          prerequisite_task_id: prereqId,
        });
      }
    }
  }

  const hasApproval = plan.tasks.some((t) => t.requiresApproval);
  const nextIncidentVersion = incident.version + 1;
  const { error: incUpdateError } = await client.from("incidents").update({
    plan_version: nextPlanVersion,
    version: nextIncidentVersion,
    state: hasApproval ? "awaiting_approval" : "planned",
    updated_at: new Date().toISOString(),
  }).eq("id", incidentId);
  if (incUpdateError) throw new Error(`Failed to update incident: ${incUpdateError.message}`);

  if (hasApproval) {
    for (const t of plan.tasks) {
      if (t.requiresApproval) {
        const payloadHash = createHash("sha256").update(JSON.stringify(t)).digest("hex");
        const { error: appErr } = await client.from("approvals").insert({
          id: randomUUID(),
          institution_id: institutionId,
          incident_id: incidentId,
          plan_version: nextPlanVersion,
          action_payload_hash: payloadHash,
        });
        if (appErr) console.error("Failed to insert approval:", appErr);
      }
    }
  }

  await client.from("incident_events").insert({
    institution_id: institutionId,
    incident_id: incidentId,
    actor_type: "agent",
    action: "commander_plan_created",
    safe_payload: { planId: newPlanId, version: nextPlanVersion } as unknown as Json,
  });

  if (!hasApproval) {
    for (const t of plan.tasks) {
      if (!t.dependsOn || t.dependsOn.length === 0) {
        const taskId = taskMap.get(t.localId)!;
        await client.from("jobs").insert({
          institution_id: institutionId,
          type: "specialist",
          incident_id: incidentId,
          dedupe_key: `specialist:${taskId}:e1`,
          payload: { taskId },
        });
      }
    }
  }
}

async function persistSpecialistActionFallback(
  client: ReturnType<typeof createSupabaseAdmin>,
  job: JobRecord,
  expectedIncidentVersion: number,
  selectedStaff: { membershipId: string; capabilityVersion: number },
  actionPayload: SpecialistAction,
  agentRunId: string,
) {
  const incidentId = job.incidentId!;
  const institutionId = job.institutionId;
  const taskId = actionPayload.taskId;

  const { data: targetTask, error: taskErr } = await client.from("incident_tasks")
    .select("id, institution_id, state, plan_id, requires_approval, specialist_profile")
    .eq("id", taskId)
    .single();
  if (taskErr || !targetTask) throw new Error(`Task ${taskId} not found for specialist fallback: ${taskErr?.message}`);

  const { data: targetPlan, error: planErr } = await client.from("incident_plans")
    .select("id, incident_id, version, acknowledgement_minutes")
    .eq("id", targetTask.plan_id)
    .eq("status", "active")
    .single();
  if (planErr || !targetPlan) throw new Error(`Active plan not found for task ${taskId}: ${planErr?.message}`);

  const { data: targetIncident, error: incErr } = await client.from("incidents")
    .select("id, version, state")
    .eq("id", incidentId)
    .single();
  if (incErr || !targetIncident) throw new Error(`Incident not found: ${incErr?.message}`);
  if (targetIncident.version !== expectedIncidentVersion) {
    throw new Error(`Stale incident version: expected ${expectedIncidentVersion}, got ${targetIncident.version}`);
  }

  // Update task checklist & evidence requirements
  await client.from("incident_tasks").update({
    checklist: actionPayload.checklist as unknown as Json,
    evidence_requirements: actionPayload.evidenceRequired as unknown as Json,
  }).eq("id", taskId);

  const requiresApproval = targetTask.requires_approval || actionPayload.communicationType === "approval_request";
  if (requiresApproval) {
    const { data: existingApproval } = await client.from("approvals")
      .select("id, decision")
      .eq("incident_id", incidentId)
      .eq("plan_version", targetPlan.version)
      .eq("decision", "approved")
      .maybeSingle();

    if (!existingApproval) {
      const payloadHash = createHash("sha256").update(JSON.stringify(actionPayload)).digest("hex");
      await client.from("approvals").insert({
        institution_id: institutionId,
        incident_id: incidentId,
        action_payload_hash: payloadHash,
        plan_version: targetPlan.version,
      });

      const { data: grants } = await client.from("role_grants")
        .select("membership_id")
        .eq("institution_id", institutionId)
        .in("role", ["principal", "hod", "supervisor"])
        .is("revoked_at", null);

      if (grants && grants.length > 0) {
        await client.from("notifications").insert(
          grants.map((g) => ({
            institution_id: institutionId,
            recipient_membership_id: g.membership_id,
            safe_text: "An ORION action requires approval.",
            link: `/incidents/${incidentId}`,
          }))
        );
      }
      return null;
    }
  }

  // Proceed with assignment
  const ackMinutes = targetPlan.acknowledgement_minutes || 15;
  const ackDeadline = new Date(Date.now() + ackMinutes * 60 * 1000).toISOString();
  const assignmentId = randomUUID();

  const { error: assignErr } = await client.from("assignments").insert({
    id: assignmentId,
    institution_id: institutionId,
    task_id: taskId,
    assignee_membership_id: selectedStaff.membershipId,
    acknowledgement_deadline: ackDeadline,
    state: "offered",
    active_version: true,
  });
  if (assignErr) throw new Error(`Failed to insert assignment: ${assignErr.message}`);

  await client.from("incident_tasks").update({ state: "assigned" }).eq("id", taskId);

  // Lookup assignee email
  const { data: member } = await client.from("institution_memberships")
    .select("id, user_id")
    .eq("id", selectedStaff.membershipId)
    .single();

  let recipientEmail: string | null = null;
  if (member?.user_id) {
    try {
      const { data: authUser } = await client.auth.admin.getUserById(member.user_id);
      recipientEmail = authUser?.user?.email ?? null;
    } catch {
      // fallback
    }
  }
  if (!recipientEmail) {
    recipientEmail = "staff.electrician@orion-demo.edu";
  }

  const outboxId = randomUUID();
  const { error: outboxErr } = await client.from("email_outbox").insert({
    id: outboxId,
    institution_id: institutionId,
    assignment_id: assignmentId,
    assignment_version: 1,
    recipient: recipientEmail,
    message_type: actionPayload.communicationType,
    idempotency_key: `assignment:${assignmentId}:v1`,
    transport_state: "queued",
  });
  if (outboxErr) throw new Error(`Failed to insert outbox: ${outboxErr.message}`);

  // Enqueue outbox delivery job
  await client.from("jobs").insert({
    institution_id: institutionId,
    type: "outbox_delivery",
    incident_id: incidentId,
    dedupe_key: `outbox:assignment:${assignmentId}:v1`,
    payload: { outboxId } as unknown as Json,
  });

  // Enqueue reminder & escalation jobs
  await client.from("jobs").insert([
    {
      institution_id: institutionId,
      incident_id: incidentId,
      type: "ack_reminder",
      dedupe_key: `ack-reminder:${assignmentId}`,
      payload: { assignmentId } as unknown as Json,
      due_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    },
    {
      institution_id: institutionId,
      incident_id: incidentId,
      type: "assignment_escalation",
      dedupe_key: `ack-escalation:${assignmentId}`,
      payload: { assignmentId } as unknown as Json,
      due_at: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
    },
  ]);

  // Notify staff member
  await client.from("notifications").insert({
    institution_id: institutionId,
    recipient_membership_id: selectedStaff.membershipId,
    safe_text: "A new ORION task requires acknowledgement.",
    link: "/staff#evidence",
  });

  // Log incident event
  await client.from("incident_events").insert({
    institution_id: institutionId,
    incident_id: incidentId,
    actor_type: "agent",
    action: "specialist_assignment_created",
    safe_payload: { assignmentId, agentRunId } as unknown as Json,
  });

  // Advance incident state
  await client.from("incidents").update({
    state: "assigned",
    version: targetIncident.version + 1,
    updated_at: new Date().toISOString(),
  }).eq("id", incidentId);

  return assignmentId;
}

