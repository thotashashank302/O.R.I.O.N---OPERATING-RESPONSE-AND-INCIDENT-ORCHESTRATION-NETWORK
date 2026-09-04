import { IncidentRepository } from './intake-service';
import { UPLOAD_LIMITS } from '@/contracts/reporting';

export interface VoteRecord {
  incidentId: string;
  membershipId: string;
  votedAt: string;
}

const votesStore = new Map<string, VoteRecord>(); // key: `${incidentId}:${membershipId}`
const voteRateLimitStore = new Map<string, number[]>(); // memberId -> timestamps

export function checkAndIncrementVoteRateLimit(
  memberId: string,
  nowMs: number = Date.now()
): { allowed: boolean; remaining: number } {
  const oneMinuteAgo = nowMs - 60 * 1000;
  const timestamps = voteRateLimitStore.get(memberId) || [];
  const recent = timestamps.filter((t) => t > oneMinuteAgo);

  if (recent.length >= UPLOAD_LIMITS.maxVotesPerMinute) {
    return { allowed: false, remaining: 0 };
  }

  recent.push(nowMs);
  voteRateLimitStore.set(memberId, recent);
  return {
    allowed: true,
    remaining: UPLOAD_LIMITS.maxVotesPerMinute - recent.length,
  };
}

export function resetVotesForTesting() {
  votesStore.clear();
  voteRateLimitStore.clear();
}

/**
 * Casts a vote on an incident to signal impact (atomic and idempotent).
 */
export async function castVote(
  incidentId: string,
  voterMembership: { id: string; institutionId: string },
  options: { nowMs?: number } = {}
): Promise<{ voteCount: number; hasVoted: boolean; incidentVersion: number }> {
  // 1. Rate limit check (30/min)
  const rate = checkAndIncrementVoteRateLimit(voterMembership.id, options.nowMs);
  if (!rate.allowed) {
    throw new Error('Vote rate limit exceeded: Maximum 30 votes per minute.');
  }

  // 2. Fetch incident
  const incident = await IncidentRepository.getIncidentById(incidentId);
  if (!incident) {
    throw new Error('Incident not found.');
  }

  // 3. Tenant check
  if (incident.institutionId !== voterMembership.institutionId) {
    throw new Error('Unauthorized: Cross-institution voting is prohibited.');
  }

  // 4. Confidential check: confidential issues cannot be voted on!
  if (incident.isConfidential || incident.visibility === 'confidential') {
    throw new Error('Forbidden: Confidential safety complaints are strictly excluded from voting feeds.');
  }

  // 5. Unique voter check (Idempotent: if already voted, return current state without inflating count)
  const voteKey = `${incidentId}:${voterMembership.id}`;
  if (votesStore.has(voteKey)) {
    return {
      voteCount: incident.voteCount,
      hasVoted: true,
      incidentVersion: incident.version,
    };
  }

  // Record vote
  votesStore.set(voteKey, {
    incidentId,
    membershipId: voterMembership.id,
    votedAt: new Date(options.nowMs || Date.now()).toISOString(),
  });

  incident.voteCount += 1;
  incident.version += 1;
  incident.updatedAt = new Date(options.nowMs || Date.now()).toISOString();
  await IncidentRepository.saveIncident(incident);

  return {
    voteCount: incident.voteCount,
    hasVoted: true,
    incidentVersion: incident.version,
  };
}

/**
 * Removes a previously cast vote (idempotent).
 */
export async function removeVote(
  incidentId: string,
  voterMembership: { id: string; institutionId: string },
  options: { nowMs?: number } = {}
): Promise<{ voteCount: number; hasVoted: boolean; incidentVersion: number }> {
  const rate = checkAndIncrementVoteRateLimit(voterMembership.id, options.nowMs);
  if (!rate.allowed) {
    throw new Error('Vote rate limit exceeded: Maximum 30 votes per minute.');
  }

  const incident = await IncidentRepository.getIncidentById(incidentId);
  if (!incident) {
    throw new Error('Incident not found.');
  }

  if (incident.institutionId !== voterMembership.institutionId) {
    throw new Error('Unauthorized: Cross-institution voting is prohibited.');
  }

  const voteKey = `${incidentId}:${voterMembership.id}`;
  if (!votesStore.has(voteKey)) {
    return {
      voteCount: incident.voteCount,
      hasVoted: false,
      incidentVersion: incident.version,
    };
  }

  votesStore.delete(voteKey);
  incident.voteCount = Math.max(0, incident.voteCount - 1);
  incident.version += 1;
  incident.updatedAt = new Date(options.nowMs || Date.now()).toISOString();
  await IncidentRepository.saveIncident(incident);

  return {
    voteCount: incident.voteCount,
    hasVoted: false,
    incidentVersion: incident.version,
  };
}

/**
 * Checks if a member has voted on a specific incident.
 */
export function hasMemberVoted(incidentId: string, memberId: string): boolean {
  return votesStore.has(`${incidentId}:${memberId}`);
}
