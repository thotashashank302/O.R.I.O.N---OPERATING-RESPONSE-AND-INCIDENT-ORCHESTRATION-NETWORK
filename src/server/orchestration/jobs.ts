import { randomUUID } from "node:crypto";
import type { JobStatus } from "@/contracts/domain";

export const JOB_TYPES = [
  "commander_enqueue", "commander", "specialist", "verification", "ack_reminder",
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
  workerId?: string;
  payload: Record<string, unknown>;
}

export interface JobStore {
  claim(workerId: string, limit: number, leaseSeconds: number): Promise<JobRecord[]>;
  succeed(job: JobRecord): Promise<void>;
  retry(job: JobRecord, dueAt: Date, safeError: string): Promise<void>;
  dead(job: JobRecord, safeError: string): Promise<void>;
  renew?(job: JobRecord, leaseSeconds: number): Promise<void>;
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
    private readonly options = { maxAttempts: 3, leaseSeconds: 290, batchSize: 1, budgetMs: 90_000 },
  ) {}

  async tick(workerId: string, startedAt = Date.now()): Promise<WorkerResult> {
    workerId = `${workerId}:${randomUUID()}`;
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
        let leaseError: unknown;
        let renewal: Promise<void> = Promise.resolve();
        const heartbeat = this.store.renew ? setInterval(() => {
          renewal = renewal.then(() => this.store.renew!(job, this.options.leaseSeconds)).catch(error => { leaseError = error; });
        }, 30_000) : undefined;
        try {
          if (job.attempt > this.options.maxAttempts) throw new Error("Job exceeded its attempt limit after lease recovery");
          if (!handler) throw new Error(`No handler registered for ${job.type}`);
          await handler(job);
          clearInterval(heartbeat);
          await renewal;
          if (leaseError) throw leaseError;
          await this.store.succeed(job);
          result.succeeded += 1;
        } catch (error) {
          if (leaseError) throw leaseError;
          const reason = error instanceof Error
            ? error.message.slice(0, 300)
            : typeof error === "object" && error !== null && "message" in error && typeof (error as { message: unknown }).message === "string"
            ? (error as { message: string }).message.slice(0, 300)
            : String(error).slice(0, 300);
          if (job.attempt >= this.options.maxAttempts) {
            await this.store.dead(job, reason);
            await this.store.notifySupervisor(job, reason);
            result.dead += 1;
          } else {
            const minutes = 2 ** Math.max(0, job.attempt - 1);
            await this.store.retry(job, new Date(Date.now() + minutes * 60_000), reason);
            result.retried += 1;
          }
        } finally {
          clearInterval(heartbeat);
          await renewal;
        }
      }
    }
    result.stoppedForBudget = Date.now() - startedAt >= this.options.budgetMs;
    return result;
  }
}
