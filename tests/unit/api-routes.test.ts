import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('next/server', async (importOriginal) => ({
  ...await importOriginal<typeof import('next/server')>(),
  after: vi.fn(),
}));
vi.mock('@/server/orchestration/production-worker', () => ({ createProductionWorker: vi.fn() }));

vi.mock('@/server/auth/request-context', () => ({
  requireRequestContext: vi.fn(async (request: Request) => ({
    requestId: 'test-request',
    userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    institutionId: request.headers.get('x-institution-id') ?? '11111111-1111-4111-a111-111111111111',
    membershipId: request.headers.get('x-member-id') ?? 'student-membership-001',
    roles: ['student', 'cr'],
    departmentIds: [],
    sectionIds: [],
  })),
}));
const persistentState = vi.hoisted(() => ({ voteCount: 0 }));
vi.mock('@/server/reporting/persistent-service', () => ({
  createPersistentIncident: vi.fn(async (_context: unknown, input: { categorySuggestion?: string }) => ({
    incident: { id: '33333333-3333-4333-a333-333333333333', category: input.categorySuggestion ?? 'other' },
    job: { id: 'job-1' },
    rateLimitRemaining: 4,
  })),
  listPersistentIncidents: vi.fn(async () => []),
  setPersistentVote: vi.fn(async (_context: unknown, _id: string, voted: boolean) => {
    persistentState.voteCount = voted ? 1 : 0;
    return { voteCount: persistentState.voteCount, hasVoted: voted };
  }),
}));
vi.mock('@/server/reporting/upload-service', () => ({
  authorizePrivateUpload: vi.fn(async () => ({
    uploadUrl: 'https://storage.test/signed-upload',
    storageKey: 'institutions/test/incidents/upload.png',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    maxSizeBytes: 5 * 1024 * 1024,
  })),
}));
import { NextRequest } from 'next/server';
import { POST as createIncidentHandler } from '@/app/api/incidents/route';
import { PUT as voteHandler, DELETE as unvoteHandler } from '@/app/api/incidents/[id]/vote/route';
import { POST as uploadHandler } from '@/app/api/uploads/route';

describe('Developer 3: API Route Endpoints (HTTP Contract Compliance)', () => {
  const institutionId = '11111111-1111-4111-a111-111111111111';
  const memberId = 'student-membership-001';
  const otherMemberId = 'student-membership-002';

  beforeEach(() => {
    persistentState.voteCount = 0;
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
