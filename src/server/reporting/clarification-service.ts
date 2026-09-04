import { IncidentRecord, IncidentRepository, QueuedJob } from './intake-service';

export interface ClarificationAnswerInput {
  incidentId: string;
  expectedVersion: number;
  answer: string;
  updatedLocationText?: string;
  additionalAttachments?: Array<{
    storageKey: string;
    fileName: string;
    fileSize: number;
    mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  }>;
}

/**
 * Handles answering a pending clarification request from the triage agent.
 * Resumes orchestration by queuing the plan generation job.
 */
export async function submitClarificationAnswer(
  reporterMembershipId: string,
  input: ClarificationAnswerInput,
  options: { nowMs?: number } = {}
): Promise<{ incident: IncidentRecord; job: QueuedJob }> {
  const incident = await IncidentRepository.getIncidentById(input.incidentId);
  if (!incident) {
    throw new Error('Incident not found.');
  }

  // 1. Authorization: Only reporter can answer clarification
  if (incident.reporterId !== reporterMembershipId) {
    throw new Error('Unauthorized: Only the reporting student or CR can answer clarifications.');
  }

  // 2. State verification
  if (incident.state !== 'needs_clarification') {
    throw new Error(
      `Incident is currently in state '${incident.state}', not awaiting clarification.`
    );
  }

  // 3. Version concurrency check
  if (incident.version !== input.expectedVersion) {
    throw new Error(
      `Version mismatch (409 Conflict): Expected version ${input.expectedVersion}, but incident is at version ${incident.version}.`
    );
  }

  // 4. Update incident with answer
  const nowIso = new Date(options.nowMs || Date.now()).toISOString();
  incident.clarificationRequest = {
    question: incident.clarificationRequest?.question || 'Provide missing room details',
    missingFields: incident.clarificationRequest?.missingFields || ['room_or_lab_number'],
    answeredAt: nowIso,
    answer: input.answer,
  };

  if (input.updatedLocationText) {
    incident.locationText = input.updatedLocationText;
  }

  if (input.additionalAttachments?.length) {
    incident.attachments.push(...input.additionalAttachments);
  }

  // Resume incident state to triaging / ready for plan generation
  incident.state = 'triaging';
  incident.version += 1;
  incident.updatedAt = nowIso;
  await IncidentRepository.saveIncident(incident);

  // 5. Enqueue plan generation job
  const job: QueuedJob = {
    id: crypto.randomUUID(),
    incidentId: incident.id,
    type: 'plan_generation',
    status: 'queued',
    dueAt: nowIso,
  };
  await IncidentRepository.enqueueJob(job);

  return { incident, job };
}
