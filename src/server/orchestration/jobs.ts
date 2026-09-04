import type { JobStatus } from "@/contracts/domain";

export const JOB_TYPES = [
  "commander", "specialist", "ack_reminder",
  "assignment_escalation", "verifier_reminder", "verifier_escalation", "outbox_delivery",
] as const;
export type JobType = (typeof JOB_TYPES)[number];

export interface JobRecord {
  id: string;
  type: JobType;
  incidentId: string | null;
  institutionId: string;
  status: JobStatus;
  attempt: number;
  dueAt: Date;
  leaseUntil: Date | null;
  payload: Record<string, unknown>;
}

export interface JobStore {
  claim(workerId: string, limit: number, leaseSeconds: number): Promise<JobRecord[]>;
  succeed(jobId: string): Promise<void>;
  retry(jobId: string, dueAt: Date, safeError: string): Promise<void>;
  dead(jobId: string, safeError: string): Promise<void>;
  notifySupervisor(job: JobRecord, reason: string): Promise<void>;
}

export type JobHandler = (job: JobRecord) => Promise<void>;

export interface WorkerResult {
  claimed: number;
  succeeded: number;
  retried: number;
  dead: number;
  stoppedForBudget: boolean;
}

export class DurableJobWorker {
  constructor(
    private readonly store: JobStore,
    private readonly handlers: Partial<Record<JobType, JobHandler>>,
    private readonly options = { maxAttempts: 3, leaseSeconds: 290, batchSize: 5, budgetMs: 250_000 },
  ) {}

  async tick(workerId: string, startedAt = Date.now()): Promise<WorkerResult> {
    const result: WorkerResult = { claimed: 0, succeeded: 0, retried: 0, dead: 0, stoppedForBudget: false };
    while (Date.now() - startedAt < this.options.budgetMs) {
      const jobs = await this.store.claim(workerId, this.options.batchSize, this.options.leaseSeconds);
      result.claimed += jobs.length;
      if (jobs.length === 0) break;
      for (const job of jobs) {
        if (Date.now() - startedAt >= this.options.budgetMs) {
          result.stoppedForBudget = true;
          return result;
        }
        const handler = this.handlers[job.type];
        try {
          if (!handler) throw new Error(`No handler registered for ${job.type}`);
          await handler(job);
          await this.store.succeed(job.id);
          result.succeeded += 1;
        } catch (error) {
          const reason = error instanceof Error ? error.message.slice(0, 300) : "Unknown job failure";
          if (job.attempt >= this.options.maxAttempts) {
            await this.store.dead(job.id, reason);
            await this.store.notifySupervisor(job, reason);
            result.dead += 1;
          } else {
            const minutes = 2 ** Math.max(0, job.attempt - 1);
            await this.store.retry(job.id, new Date(Date.now() + minutes * 60_000), reason);
            result.retried += 1;
          }
        }
      }
    }
    result.stoppedForBudget = Date.now() - startedAt >= this.options.budgetMs;
    return result;
  }
}
