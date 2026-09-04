import { describe, it, expect, beforeEach } from 'vitest';
import {
  createIncident,
  IncidentRepository,
  resetRateLimitsForTesting,
} from '@/server/reporting/intake-service';
import {
  authorizePrivateUpload,
} from '@/server/reporting/upload-service';
import {
  castVote,
  removeVote,
  resetVotesForTesting,
} from '@/server/reporting/voting-service';
import {
  createPrivateConfidentialReport,
  canViewConfidentialIncident,
} from '@/server/reporting/private-intake-service';
import {
  submitClarificationAnswer,
} from '@/server/reporting/clarification-service';
import {
  submitReporterConfirmation,
  cancelIncidentByReporter,
} from '@/server/reporting/confirmation-service';

describe('Developer 3: Reporting, Voting & Verification Lifecycle (P0 Suite)', () => {
  const institutionId = '11111111-1111-4111-a111-111111111111';
  const otherInstitutionId = '22222222-2222-4222-a222-222222222222';
  const studentReporter = 'student-membership-001';
  const otherStudent = 'student-membership-002';
  const accusedStaff = 'staff-membership-accused';

  beforeEach(() => {
    IncidentRepository.clear();
    resetRateLimitsForTesting();
    resetVotesForTesting();
  });

  describe('A1: Report Intake & Rate Limits', () => {
    it('creates a routine classroom incident and enqueues orchestration job', async () => {
      const { incident, job, rateLimitRemaining } = await createIncident(studentReporter, {
        institutionId,
        categorySuggestion: 'classroom_infrastructure',
        description: 'The ceiling projector is displaying green vertical lines.',
        locationText: 'Room 401, Science Block',
        visibility: 'routine',
        isConfidential: false,
        reportingScope: 'student',
        attachments: [],
      });

      expect(incident.id).toBeDefined();
      expect(incident.state).toBe('triaging');
      expect(incident.category).toBe('classroom_infrastructure');
      expect(incident.version).toBe(1);
      expect(job.type).toBe('plan_generation');
      expect(job.status).toBe('queued');
      expect(rateLimitRemaining).toBe(4);
    });

    it('enforces 5 reports per hour rate limit', async () => {
      const payload = {
        institutionId,
        description: 'Routine maintenance request for testing rate limit',
        locationText: 'Room 101, Main Block',
        visibility: 'routine' as const,
        isConfidential: false,
        reportingScope: 'student' as const,
        attachments: [],
      };

      for (let i = 0; i < 5; i++) {
        await createIncident(studentReporter, payload);
      }

      // 6th report within the hour must fail
      await expect(createIncident(studentReporter, payload)).rejects.toThrow(
        /Rate limit exceeded/
      );
    });

    it('flags needs_clarification when location lacks room detail', async () => {
      const { incident, job } = await createIncident(studentReporter, {
        institutionId,
        description: 'Water leaking from the ceiling somewhere in the building.',
        locationText: 'somewhere in campus',
        visibility: 'routine',
        isConfidential: false,
        reportingScope: 'student',
        attachments: [],
      });

      expect(incident.state).toBe('needs_clarification');
      expect(incident.clarificationRequest?.missingFields).toContain('room_or_lab_number');
      expect(job.type).toBe('clarification_wait');
    });
  });

  describe('A1: Private Upload Authorization', () => {
    it('authorizes private upload under 5MB for valid MIME types', async () => {
      const result = await authorizePrivateUpload({
        institutionId,
        memberId: studentReporter,
        fileName: 'broken_bench.jpg',
        fileSize: 2 * 1024 * 1024,
        mimeType: 'image/jpeg',
      });

      expect(result.uploadUrl).toContain('mock-storage');
      expect(result.storageKey).toContain(institutionId);
      expect(result.storageKey).toMatch(/\.(jpg|jpeg)$/);
      expect(result.maxSizeBytes).toBe(5 * 1024 * 1024);
    });

    it('rejects uploads exceeding 5MB or with disallowed MIME types', async () => {
      await expect(
        authorizePrivateUpload({
          institutionId,
          memberId: studentReporter,
          fileName: 'huge_video.mp4',
          fileSize: 10 * 1024 * 1024,
          mimeType: 'image/jpeg',
        })
      ).rejects.toThrow(/exceeds the 5MB maximum limit/);

      await expect(
        authorizePrivateUpload({
          institutionId,
          memberId: studentReporter,
          fileName: 'script.html',
          fileSize: 1024,
          mimeType: 'text/html',
        })
      ).rejects.toThrow(/Invalid file type/);
    });
  });

  describe('A2: Voting & Impact Measurement', () => {
    it('allows students to cast unique atomic votes and remove them', async () => {
      const { incident } = await createIncident(studentReporter, {
        institutionId,
        description: 'Projector broken in Room 302.',
        locationText: 'Room 302, CS Block',
        visibility: 'routine',
        isConfidential: false,
        reportingScope: 'student',
        attachments: [],
      });

      // Vote 1
      const res1 = await castVote(incident.id, { id: otherStudent, institutionId });
      expect(res1.voteCount).toBe(1);
      expect(res1.hasVoted).toBe(true);

      // Duplicate vote is idempotent and does NOT inflate vote count
      const resDuplicate = await castVote(incident.id, { id: otherStudent, institutionId });
      expect(resDuplicate.voteCount).toBe(1);

      // Remove vote
      const resRemoved = await removeVote(incident.id, { id: otherStudent, institutionId });
      expect(resRemoved.voteCount).toBe(0);
      expect(resRemoved.hasVoted).toBe(false);
    });

    it('strictly forbids voting on confidential safety complaints', async () => {
      const { incident } = await createPrivateConfidentialReport(studentReporter, institutionId, {
        description: 'Harassment complaint regarding misconduct in faculty room.',
        locationText: 'Faculty Room 204',
        category: 'confidential_complaint',
      });

      await expect(
        castVote(incident.id, { id: otherStudent, institutionId })
      ).rejects.toThrow(/strictly excluded from voting/);
    });

    it('rejects cross-institution votes', async () => {
      const { incident } = await createIncident(studentReporter, {
        institutionId,
        description: 'Water cooler broken in Mech block.',
        locationText: 'Ground Floor, Mech Block',
        visibility: 'routine',
        isConfidential: false,
        reportingScope: 'student',
        attachments: [],
      });

      await expect(
        castVote(incident.id, { id: otherStudent, institutionId: otherInstitutionId })
      ).rejects.toThrow(/Cross-institution voting is prohibited/);
    });
  });

  describe('B1: Private Complaints & Accused Exclusion', () => {
    it('creates confidential complaint and excludes accused from case access', async () => {
      const { incident, contacts } = await createPrivateConfidentialReport(
        studentReporter,
        institutionId,
        {
          description: 'Staff member demanding unofficial fees for lab entry.',
          locationText: 'EE Machines Lab',
          category: 'confidential_complaint',
          accusedMembershipId: accusedStaff,
        }
      );

      expect(incident.isConfidential).toBe(true);
      expect(incident.visibility).toBe('confidential');
      expect(contacts.campusSecurityPhone).toBeDefined();

      // Accused identity cannot view case
      expect(canViewConfidentialIncident(incident.id, accusedStaff)).toBe(false);

      // Reporter can view case
      expect(canViewConfidentialIncident(incident.id, studentReporter)).toBe(true);

      // Principal can view case
      expect(canViewConfidentialIncident(incident.id, 'principal-user', ['principal'])).toBe(true);

      // Unrelated student cannot view case in list
      const publicList = await IncidentRepository.listIncidents(institutionId, otherStudent);
      expect(publicList.find((i) => i.id === incident.id)).toBeUndefined();
    });
  });

  describe('B2: Clarification Flow', () => {
    it('resumes incident orchestration after reporter provides missing details', async () => {
      const { incident } = await createIncident(studentReporter, {
        institutionId,
        description: 'Projector stopped working somewhere on the 3rd floor.',
        locationText: 'somewhere 3rd floor',
        visibility: 'routine',
        isConfidential: false,
        reportingScope: 'student',
        attachments: [],
      });

      expect(incident.state).toBe('needs_clarification');

      const { incident: updatedIncident, job } = await submitClarificationAnswer(
        studentReporter,
        {
          incidentId: incident.id,
          expectedVersion: incident.version,
          answer: 'The issue is in Room 305, next to the staircase.',
          updatedLocationText: 'Room 305, 3rd Floor',
        }
      );

      expect(updatedIncident.state).toBe('triaging');
      expect(updatedIncident.locationText).toBe('Room 305, 3rd Floor');
      expect(updatedIncident.clarificationRequest?.answer).toBe(
        'The issue is in Room 305, next to the staircase.'
      );
      expect(job.type).toBe('plan_generation');
    });

    it('rejects clarification from unauthorized members or with stale version', async () => {
      const { incident } = await createIncident(studentReporter, {
        institutionId,
        description: 'Fan not working somewhere.',
        locationText: 'somewhere',
        visibility: 'routine',
        isConfidential: false,
        reportingScope: 'student',
        attachments: [],
      });

      await expect(
        submitClarificationAnswer(otherStudent, {
          incidentId: incident.id,
          expectedVersion: incident.version,
          answer: 'Test answer',
        })
      ).rejects.toThrow(/Unauthorized/);

      await expect(
        submitClarificationAnswer(studentReporter, {
          incidentId: incident.id,
          expectedVersion: 999, // stale version
          answer: 'Test answer',
        })
      ).rejects.toThrow(/Version mismatch/);
    });
  });

  describe('C1: Functional Verification & Safe Lifecycle', () => {
    it('accepts resolution when authorized CR/reporter verifies', async () => {
      const { incident } = await createIncident(studentReporter, {
        institutionId,
        description: 'Lab PC 12 power supply failed.',
        locationText: 'Computer Lab 2, Room 102',
        visibility: 'routine',
        isConfidential: false,
        reportingScope: 'cr',
        attachments: [],
      });

      // Advance incident to submitted_for_verification (simulating staff work submission)
      incident.state = 'submitted_for_verification';
      await IncidentRepository.saveIncident(incident);

      const { incident: resolvedIncident, verification } = await submitReporterConfirmation(
        studentReporter,
        {
          incidentId: incident.id,
          decision: 'accepted',
          reason: 'Tested PC 12, powers on and boots correctly now.',
          evidenceVersion: 1,
          expectedVersion: incident.version,
        }
      );

      expect(resolvedIncident.state).toBe('resolved');
      expect(verification.decision).toBe('accepted');
    });

    it('triggers replanning when reporter rejects verification because problem persists', async () => {
      const { incident } = await createIncident(studentReporter, {
        institutionId,
        description: 'Projector still flickering in Room 302.',
        locationText: 'Room 302, CS Block',
        visibility: 'routine',
        isConfidential: false,
        reportingScope: 'student',
        attachments: [],
      });

      incident.state = 'submitted_for_verification';
      await IncidentRepository.saveIncident(incident);

      const { incident: reopenedIncident, verification, job } =
        await submitReporterConfirmation(studentReporter, {
          incidentId: incident.id,
          decision: 'rejected',
          reason: 'Staff cleaned the filter, but the lamp still turns off after 2 minutes.',
          evidenceVersion: 1,
          expectedVersion: incident.version,
        });

      expect(reopenedIncident.state).toBe('reopened');
      expect(verification.decision).toBe('rejected');
      expect(job?.type).toBe('plan_generation');
    });

    it('rejects verification from an unrelated student', async () => {
      const { incident } = await createIncident(studentReporter, {
        institutionId,
        description: 'AC not cooling in Seminar Hall.',
        locationText: 'Seminar Hall A',
        visibility: 'routine',
        isConfidential: false,
        reportingScope: 'student',
        attachments: [],
      });

      incident.state = 'submitted_for_verification';
      await IncidentRepository.saveIncident(incident);

      await expect(
        submitReporterConfirmation(otherStudent, {
          incidentId: incident.id,
          decision: 'accepted',
          reason: 'Looks fine to me',
          evidenceVersion: 1,
          expectedVersion: incident.version,
        })
      ).rejects.toThrow(/Unauthorized/);
    });

    it('allows reporter to safely cancel incident if resolved independently', async () => {
      const { incident } = await createIncident(studentReporter, {
        institutionId,
        description: 'Forgot ID card in Room 201.',
        locationText: 'Room 201',
        visibility: 'routine',
        isConfidential: false,
        reportingScope: 'student',
        attachments: [],
      });

      const cancelled = await cancelIncidentByReporter(
        studentReporter,
        incident.id,
        'Found ID card with the security desk.',
        incident.version
      );

      expect(cancelled.state).toBe('cancelled');
    });
  });
});
