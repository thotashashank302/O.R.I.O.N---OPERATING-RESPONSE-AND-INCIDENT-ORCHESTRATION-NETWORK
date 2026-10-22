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
        workerId,
        attempt: job.attempt,
        dueAt: new Date(job.due_at),
        leaseUntil: job.lease_until ? new Date(job.lease_until) : null,
        payload: job.payload ?? {},
      };
    });
  }

  private async control(job: JobRecord, operation: string, nextDue?: Date, reason?: string, leaseSeconds = 290): Promise<void> {
    const { error } = await this.client.rpc("orion_job_control", {
      target_id: job.id, claim_worker: job.workerId, claim_attempt: job.attempt,
      operation, lease_seconds: leaseSeconds, next_due: nextDue?.toISOString(), reason,
    });
    if (error) throw error;
  }
  async renew(job: JobRecord, leaseSeconds: number) { await this.control(job, "renew", undefined, undefined, leaseSeconds); }
  async succeed(job: JobRecord) { await this.control(job, "succeed"); }
  async retry(job: JobRecord, dueAt: Date, reason: string) { await this.control(job, "retry", dueAt, reason); }
  async dead(job: JobRecord, reason: string) { await this.control(job, "dead", undefined, reason); }
  async notifySupervisor() { /* Dead-job escalation commits inside orion_job_control. */ }
}
