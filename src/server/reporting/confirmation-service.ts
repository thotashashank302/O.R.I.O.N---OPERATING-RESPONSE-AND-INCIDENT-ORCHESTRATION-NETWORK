import { ReporterConfirmationInput, ReporterConfirmationSchema } from '@/contracts/reporting';
import { IncidentRecord, IncidentRepository, QueuedJob } from './intake-service';

export interface VerificationRecord {
  id: string;
  incidentId: string;
  verifierMembershipId: string;
  decision: 'accepted' | 'rejected';
  reason: string;
  evidenceVersion: number;
  recordedAt: string;
}

const verificationStore = new Map<string, VerificationRecord[]>();

/**
 * Handles reporter-side or authorized student CR confirmation of a resolved incident.
 * Enforces:
 * 1. Only authorized reporter/CR can confirm.
 * 2. Incident must currently be in 'submitted_for_verification'.
 * 3. Stale version matching (409 Conflict if expectedVersion differs).
 * 4. Staff submission alone NEVER closes the incident without reporter confirmation.
 * 5. If rejected, triggers replanning job and sets status to 'reopened' or 'triaging'.
 */
export async function submitReporterConfirmation(
  verifierMembershipId: string,
  input: ReporterConfirmationInput,
  options: { nowMs?: number; verifierRoles?: string[] } = {}
): Promise<{ incident: IncidentRecord; verification: VerificationRecord; job?: QueuedJob }> {
  const validated = ReporterConfirmationSchema.parse(input);

  const incident = await IncidentRepository.getIncidentById(validated.incidentId);
  if (!incident) {
    throw new Error('Incident not found.');
  }

  // 1. Authorization check: Verifier must be original reporter, CR, or lab authority
  const isReporter = incident.reporterId === verifierMembershipId;
  const isAuthorizedRole =
    options.verifierRoles?.includes('cr') ||
    options.verifierRoles?.includes('lab_assistant') ||
    options.verifierRoles?.includes('hod');

  if (!isReporter && !isAuthorizedRole) {
    throw new Error('Unauthorized: Only the designated reporter or class representative can verify resolution.');
  }

  // 2. State check: Must be in submitted_for_verification
  if (incident.state !== 'submitted_for_verification') {
    throw new Error(
      `Invalid incident state: Cannot verify incident in state '${incident.state}'. Must be 'submitted_for_verification'.`
    );
  }

  // 3. Optimistic concurrency version check
  if (incident.version !== validated.expectedVersion) {
    throw new Error(
      `Version mismatch (409 Conflict): Expected version ${validated.expectedVersion}, but incident is at version ${incident.version}.`
    );
  }

  const nowIso = new Date(options.nowMs || Date.now()).toISOString();
  const verificationRecord: VerificationRecord = {
    id: crypto.randomUUID(),
    incidentId: incident.id,
    verifierMembershipId,
    decision: validated.decision,
    reason: validated.reason,
    evidenceVersion: validated.evidenceVersion,
    recordedAt: nowIso,
  };

  const existingRecords = verificationStore.get(incident.id) || [];
  existingRecords.push(verificationRecord);
  verificationStore.set(incident.id, existingRecords);

  let nextJob: QueuedJob | undefined;

  if (validated.decision === 'accepted') {
    // Incident is successfully closed by the human reporter
    incident.state = 'resolved';
    incident.version += 1;
    incident.updatedAt = nowIso;
    await IncidentRepository.saveIncident(incident);
  } else {
    // Rejection: Triggers replanning
    incident.state = 'reopened';
    incident.version += 1;
    incident.updatedAt = nowIso;
    await IncidentRepository.saveIncident(incident);

    nextJob = {
      id: crypto.randomUUID(),
      incidentId: incident.id,
      type: 'plan_generation',
      status: 'queued',
      dueAt: nowIso,
    };
    await IncidentRepository.enqueueJob(nextJob);
  }

  return { incident, verification: verificationRecord, job: nextJob };
}

/**
 * Allows the original reporter to safely cancel their open report if resolved independently.
 */
export async function cancelIncidentByReporter(
  reporterMembershipId: string,
  incidentId: string,
  reason: string,
  expectedVersion: number,
  options: { nowMs?: number } = {}
): Promise<IncidentRecord> {
  const incident = await IncidentRepository.getIncidentById(incidentId);
  if (!incident) {
    throw new Error('Incident not found.');
  }

  if (incident.reporterId !== reporterMembershipId) {
    throw new Error('Unauthorized: Only the original reporter can cancel this incident.');
  }

  if (['resolved', 'cancelled'].includes(incident.state)) {
    throw new Error(`Incident is already ${incident.state}.`);
  }

  if (incident.version !== expectedVersion) {
    throw new Error(`Version conflict: Expected version ${expectedVersion}, got ${incident.version}.`);
  }

  incident.state = 'cancelled';
  incident.version += 1;
  incident.updatedAt = new Date(options.nowMs || Date.now()).toISOString();
  await IncidentRepository.saveIncident(incident);

  return incident;
}
