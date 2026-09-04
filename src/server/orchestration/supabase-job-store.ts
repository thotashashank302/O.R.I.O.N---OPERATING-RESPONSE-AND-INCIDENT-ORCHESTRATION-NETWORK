import type { SupabaseClient } from "@supabase/supabase-js";
import { JOB_TYPES, type JobRecord, type JobStore, type JobType } from "./jobs";

interface ClaimedJob {
  id: string;
  type: string;
  incident_id: string | null;
  institution_id: string;
  attempt: number;
  payload: Record<string, unknown> | null;
  due_at: string;
  lease_until: string | null;
}

export class SupabaseJobStore implements JobStore {
  constructor(private readonly client: SupabaseClient) {}

  async claim(workerId: string, limit: number, leaseSeconds: number): Promise<JobRecord[]> {
    const { data, error } = await this.client.rpc("claim_jobs", {
      worker_id: workerId,
      batch_size: limit,
      lease_seconds: leaseSeconds,
    });
    if (error) throw error;
    return ((data ?? []) as ClaimedJob[]).map((job) => {
      if (!JOB_TYPES.includes(job.type as JobType)) throw new Error(`Unknown job type: ${job.type}`);
      return {
        id: job.id,
        type: job.type as JobType,
        incidentId: job.incident_id,
        institutionId: job.institution_id,
        status: "running",
        attempt: job.attempt,
        dueAt: new Date(job.due_at),
        leaseUntil: job.lease_until ? new Date(job.lease_until) : null,
        payload: job.payload ?? {},
      };
    });
  }

  async succeed(jobId: string): Promise<void> {
    const { error } = await this.client.from("jobs").update({ status: "succeeded", lease_until: null, last_error: null }).eq("id", jobId).eq("status", "running");
    if (error) throw error;
  }

  async retry(jobId: string, dueAt: Date, safeError: string): Promise<void> {
    const { error } = await this.client.from("jobs").update({ status: "retry_wait", due_at: dueAt.toISOString(), lease_until: null, last_error: safeError }).eq("id", jobId).eq("status", "running");
    if (error) throw error;
  }

  async dead(jobId: string, safeError: string): Promise<void> {
    const { error } = await this.client.from("jobs").update({ status: "dead", lease_until: null, last_error: safeError }).eq("id", jobId).eq("status", "running");
    if (error) throw error;
  }

  async notifySupervisor(job: JobRecord, reason: string): Promise<void> {
    const { error } = await this.client.rpc("record_dead_job_escalation", { job_id: job.id, safe_reason: reason });
    if (error) throw error;
  }
}
