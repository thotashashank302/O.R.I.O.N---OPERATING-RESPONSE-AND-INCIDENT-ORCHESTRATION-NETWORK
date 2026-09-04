/**
 * POST /api/tasks/[id]/verify
 * Developer 4 (Anjali) owns this endpoint.
 *
 * C1 — Human Verification Routing:
 * Triggers the Verification agent for a submitted task.
 * Shows pending verification state, rejection feedback.
 * On agent "verified" verdict for a physical task → stays pending_human.
 * On "failed" verdict → records rejection feedback and triggers D1's replan.
 *
 * Missing-verifier escalation (Revision 2 B3 / Execution Decisions §5):
 * - Reminder after 10 minutes if verifier hasn't responded
 * - HOD/designated alternate escalation after 20 minutes
 * - Never auto-resolves — stays pending_verification
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/server/db/client";
import { runVerificationAgent } from "@/server/agents/verification";
import type { VerificationContext, ResolutionEvidence } from "@/contracts/operations";
import { randomUUID } from "crypto";
import { enqueueCommanderJob } from "@/server/orchestration/commander-enqueue";
import type { Json } from "@/contracts/database";

const VerifyRequestSchema = z.object({
  evidence_version: z.number().int().positive(),
  human_result: z.enum(["confirmed", "rejected"]).optional(), // human verifier response
  rejection_reason: z.string().max(1000).optional(),
  trigger: z.enum(["agent", "human", "escalation"]).default("agent"),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = randomUUID();
  const { id: taskId } = await params;

  try {
    const session = await createClient();

    // Auth check
    const {
      data: { user },
      error: authError,
    } = await session.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: { code: "UNAUTHENTICATED", message: "Login required" }, requestId },
        { status: 401 }
      );
    }

    // Resolve membership
    const { data: membership } = await session
      .from("institution_memberships")
      .select("id, institution_id, status")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (!membership) {
      return NextResponse.json(
        { error: { code: "NO_ACTIVE_MEMBERSHIP", message: "No active membership" }, requestId },
        { status: 403 }
      );
    }


    const supabase = await createServiceClient();

    // Parse body
    const body = await request.json();
    const parsed = VerifyRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid request", details: parsed.error.flatten() }, requestId },
        { status: 422 }
      );
    }

    // Fetch task + incident context
    const { data: task, error: taskError } = await supabase
      .from("incident_tasks")
      .select(`
        id, institution_id, plan_id, logical_task_key, specialist_profile, checklist,
        state, evidence_requirements, requires_approval,
        designated_verifier_membership_id, verifier_due_at,
        incident_plans ( incident:incidents ( id, category, version, state ) )
      `)
      .eq("id", taskId)
      .eq("institution_id", membership.institution_id)
      .single();

    if (taskError || !task) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Task not found" }, requestId },
        { status: 404 }
      );
    }

    // Task must be in "submitted" state for verification
    if (task.state !== "submitted") {
      return NextResponse.json(
        { error: { code: "INVALID_STATE", message: `Task is '${task.state}', must be 'submitted' to verify` }, requestId },
        { status: 422 }
      );
    }

    const now = new Date().toISOString();
    const planRelation = task.incident_plans as unknown as
      | {
          incident:
            | { id: string; category: string; version: number; state: string }
            | null;
        }
      | null;
    const incident = planRelation?.incident;
    if (!incident) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Task incident context not found" }, requestId },
        { status: 404 }
      );
    }

    // ── Human result path ──
    if (parsed.data.trigger === "human" && parsed.data.human_result) {
      const humanResult = parsed.data.human_result;

      // Verify the caller is the designated verifier (or HOD if absent-verifier escalation)
      const isDesignatedVerifier =
        task.designated_verifier_membership_id === membership.id;

      // Check HOD fallback for absent-verifier escalation
      const { data: hodGrant } = await supabase
        .from("role_grants")
        .select("id")
        .eq("membership_id", membership.id)
        .eq("role", "hod")
        .is("revoked_at", null)
        .maybeSingle();

      if (!isDesignatedVerifier && !hodGrant) {
        return NextResponse.json(
          {
            error: {
              code: "UNAUTHORIZED",
              message: "Only the designated verifier or HOD can record human verification",
            },
            requestId,
          },
          { status: 403 }
        );
      }

      // Record human verification result
      const { data: verRecord, error: verError } = await supabase
        .from("verification_records")
        .insert({
          id: randomUUID(),
          institution_id: membership.institution_id,
          task_id: taskId,
          evidence_version: parsed.data.evidence_version,
          human_result: humanResult === "confirmed" ? "pass" : "fail",
          agent_verdict: humanResult === "confirmed" ? "pass" : "fail",
          reasons: {
            reasons: [humanResult === "confirmed"
              ? "Human verifier confirmed satisfactory completion"
              : parsed.data.rejection_reason ?? "Verifier rejected — reason not provided"],
            missingEvidence: [],
            suggestedReplanReason: humanResult === "rejected"
              ? parsed.data.rejection_reason ?? "Verification failed — replan required"
              : null,
          },
          created_at: now,
        })
        .select()
        .single();

      if (verError || !verRecord) {
        throw new Error(`Failed to record verification: ${verError?.message}`);
      }

      // Update task state
      const newTaskState = humanResult === "confirmed" ? "verified" : "failed";
      await supabase
        .from("incident_tasks")
        .update({ state: newTaskState, updated_at: now })
        .eq("id", taskId);

      // If failed → queue replan job for D1's Commander
      if (humanResult === "rejected") {
        await enqueueCommanderJob(
          incident.id,
          parsed.data.rejection_reason ?? `Task ${taskId} was rejected by its human verifier`,
          `human-verification-${taskId}-e${parsed.data.evidence_version}`,
        );
      }

      // Append event
      await supabase.from("incident_events").insert({
        institution_id: membership.institution_id,
        incident_id: incident?.id,
        actor_membership_id: membership.id,
        actor_type: "human",
        action: `human_${humanResult}`,
        safe_payload: { task_id: taskId, evidence_version: parsed.data.evidence_version, reason: parsed.data.rejection_reason },
        created_at: now,
      });

      return NextResponse.json({ data: verRecord, requestId }, { status: 200 });
    }

    // ── Agent verification path ──
    // Fetch submitted evidence for this task
    const { data: evidenceRows } = await supabase
      .from("resolution_evidence")
      .select("id, task_id, uploader_membership_id, kind, storage_key, structured_result, evidence_version, created_at")
      .eq("task_id", taskId)
      .order("evidence_version", { ascending: false });

    const submittedEvidence: ResolutionEvidence[] = (evidenceRows ?? []).map((row) => ({
      id: row.id,
      task_id: row.task_id,
      uploader_membership_id: row.uploader_membership_id,
      kind: row.kind as ResolutionEvidence["kind"],
      content: row.storage_key ?? (row.structured_result as { content?: string } | null)?.content ?? "",
      evidence_version: row.evidence_version,
      created_at: row.created_at,
    }));

    const incidentCategory = incident?.category ?? "unknown";
    const requiresPhysical = /electrical|fan|ac|door|key|access|security|emergency|safety|plumbing/i.test(incidentCategory);

    const context: VerificationContext = {
      task_id: taskId,
      task_logical_key: task.logical_task_key,
      specialist_profile: task.specialist_profile,
      checklist: Array.isArray(task.checklist)
        ? task.checklist.filter((item): item is string => typeof item === "string")
        : [],
      evidence_requirements: Array.isArray(task.evidence_requirements)
        ? task.evidence_requirements.filter((item): item is string => typeof item === "string")
        : [],
      submitted_evidence: submittedEvidence,
      incident_category: incidentCategory,
      requires_human_physical_check: requiresPhysical,
    };

    // Run verification agent
    const decision = await runVerificationAgent(context);

    const { error: runError } = await supabase.from("agent_runs").insert({
      id: requestId,
      institution_id: membership.institution_id,
      incident_id: incident.id,
      agent_name: "verification",
      provider: "featherless",
      model: process.env.FEATHERLESS_MODEL ?? "configured-at-runtime",
      prompt_version: "verification-v1",
      latency_ms: 0,
      status: "succeeded",
      validated_outcome: decision as unknown as Json,
    });
    if (runError) throw runError;

    // Persist verification record
    const { data: verRecord } = await supabase
      .from("verification_records")
      .insert({
        id: randomUUID(),
        institution_id: membership.institution_id,
        task_id: taskId,
        evidence_version: parsed.data.evidence_version,
        human_result: "pending",
        agent_verdict: decision.verdict === "verified"
          ? "pass"
          : decision.verdict === "failed" ? "fail" : "needs_human_review",
        reasons: {
          reasons: decision.reasons,
          missingEvidence: decision.missing_evidence,
          suggestedReplanReason: decision.suggested_replan_reason,
        },
        created_at: now,
      })
      .select()
      .single();

    // Update task state based on agent verdict
    if (decision.verdict === "verified") {
      // Physical tasks cannot be agent-closed — already overridden to pending_human
      await supabase
        .from("incident_tasks")
        .update({ state: "verified", updated_at: now })
        .eq("id", taskId);
    } else if (decision.verdict === "failed") {
      await supabase
        .from("incident_tasks")
        .update({ state: "failed", updated_at: now })
        .eq("id", taskId);

      // Queue replan
      await enqueueCommanderJob(
        incident.id,
        decision.suggested_replan_reason ?? `Task ${taskId} failed agent verification`,
        `agent-verification-${taskId}-e${parsed.data.evidence_version}`,
      );
    }
    // pending_human: task stays in "submitted", verifier must respond

    // Missing-verifier escalation: schedule reminder + HOD escalation jobs
    if (decision.verdict === "pending_human") {
      const reminder10min = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const escalate20min = new Date(Date.now() + 20 * 60 * 1000).toISOString();

      // 10-min reminder
      await supabase.from("jobs").insert({
        institution_id: membership.institution_id,
        incident_id: incident?.id,
        type: "verifier_reminder",
        payload: { task_id: taskId, incident_id: incident?.id },
        status: "queued",
        due_at: reminder10min,
        attempt: 0,
        dedupe_key: `verifier-reminder-${taskId}`,
      });

      // 20-min HOD escalation
      await supabase.from("jobs").insert({
        institution_id: membership.institution_id,
        incident_id: incident?.id,
        type: "verifier_escalation",
        payload: {
          task_id: taskId,
          incident_id: incident?.id,
          reason: "No verifier response after 20 minutes",
        },
        status: "queued",
        due_at: escalate20min,
        attempt: 0,
        dedupe_key: `verifier-escalate-${taskId}`,
      });
    }

    // Append event
    await supabase.from("incident_events").insert({
      institution_id: membership.institution_id,
      incident_id: incident?.id,
      actor_membership_id: membership.id,
      actor_type: "human",
      action: "agent_verification_requested",
      safe_payload: {
        task_id: taskId,
        verdict: decision.verdict,
        evidence_version: parsed.data.evidence_version,
        missing_evidence: decision.missing_evidence,
      },
      created_at: now,
    });

    return NextResponse.json(
      { data: { decision, verification_record: verRecord }, requestId },
      { status: 200 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error(`[POST /api/tasks/${taskId}/verify] requestId=${requestId}`, message);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message }, requestId },
      { status: 500 }
    );
  }
}
