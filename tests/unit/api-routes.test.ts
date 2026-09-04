import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as createIncidentHandler, GET as listIncidentsHandler } from '@/app/api/incidents/route';
import { GET as getIncidentHandler } from '@/app/api/incidents/[id]/route';
import { PUT as voteHandler, DELETE as unvoteHandler } from '@/app/api/incidents/[id]/vote/route';
import { POST as clarifyHandler } from '@/app/api/incidents/[id]/clarifications/route';
import { POST as confirmHandler } from '@/app/api/incidents/[id]/confirm/route';
import { POST as uploadHandler } from '@/app/api/uploads/route';
import { IncidentRepository, resetRateLimitsForTesting } from '@/server/reporting/intake-service';
import { resetVotesForTesting } from '@/server/reporting/voting-service';

describe('Developer 3: API Route Endpoints (HTTP Contract Compliance)', () => {
  const institutionId = '11111111-1111-4111-a111-111111111111';
  const memberId = 'student-membership-001';
  const otherMemberId = 'student-membership-002';

  beforeEach(() => {
    IncidentRepository.clear();
    resetRateLimitsForTesting();
    resetVotesForTesting();
  });

  it('POST /api/incidents creates an incident and returns 201 with standard envelope', async () => {
    const req = new NextRequest('http://localhost:3000/api/incidents', {
      method: 'POST',
      headers: {
        'x-institution-id': institutionId,
        'x-member-id': memberId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        description: 'AC in Computer Lab 3 is leaking water continuously.',
        locationText: 'Room 304, Computer Lab 3',
        categorySuggestion: 'lab_equipment',
        visibility: 'routine',
      }),
    });

    const res = await createIncidentHandler(req);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.incident).toBeDefined();
    expect(json.data.incident.category).toBe('lab_equipment');
    expect(json.requestId).toBeDefined();
  });

  it('PUT & DELETE /api/incidents/[id]/vote increments and decrements vote atomically', async () => {
    // 1. Create incident
    const createReq = new NextRequest('http://localhost:3000/api/incidents', {
      method: 'POST',
      headers: {
        'x-institution-id': institutionId,
        'x-member-id': memberId,
      },
      body: JSON.stringify({
        description: 'Broken bench in Classroom 101.',
        locationText: 'Room 101, Main Block',
      }),
    });
    const createRes = await createIncidentHandler(createReq);
    const { incident } = (await createRes.json()).data;

    // 2. Cast vote
    const voteReq = new NextRequest(`http://localhost:3000/api/incidents/${incident.id}/vote`, {
      method: 'PUT',
      headers: {
        'x-institution-id': institutionId,
        'x-member-id': otherMemberId,
      },
    });
    const voteRes = await voteHandler(voteReq, { params: Promise.resolve({ id: incident.id }) });
    expect(voteRes.status).toBe(200);
    const voteJson = await voteRes.json();
    expect(voteJson.data.voteCount).toBe(1);
    expect(voteJson.data.hasVoted).toBe(true);

    // 3. Remove vote
    const unvoteReq = new NextRequest(`http://localhost:3000/api/incidents/${incident.id}/vote`, {
      method: 'DELETE',
      headers: {
        'x-institution-id': institutionId,
        'x-member-id': otherMemberId,
      },
    });
    const unvoteRes = await unvoteHandler(unvoteReq, { params: Promise.resolve({ id: incident.id }) });
    expect(unvoteRes.status).toBe(200);
    const unvoteJson = await unvoteRes.json();
    expect(unvoteJson.data.voteCount).toBe(0);
  });

  it('POST /api/uploads authorizes pre-signed private upload ticket', async () => {
    const req = new NextRequest('http://localhost:3000/api/uploads', {
      method: 'POST',
      headers: {
        'x-institution-id': institutionId,
        'x-member-id': memberId,
      },
      body: JSON.stringify({
        fileName: 'faulty_switch.png',
        fileSize: 1024 * 1024,
        mimeType: 'image/png',
      }),
    });

    const res = await uploadHandler(req);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.uploadUrl).toBeDefined();
    expect(json.data.storageKey).toBeDefined();
  });
});
