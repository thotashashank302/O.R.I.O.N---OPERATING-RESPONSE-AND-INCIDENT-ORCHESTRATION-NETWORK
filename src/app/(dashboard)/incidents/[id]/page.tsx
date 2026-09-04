'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';

export default function IncidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const incidentId = resolvedParams.id;

  const [incident, setIncident] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Clarification form
  const [clarificationAnswer, setClarificationAnswer] = useState('');
  const [isSubmittingClarification, setIsSubmittingClarification] = useState(false);

  // Verification form
  const [verificationReason, setVerificationReason] = useState('');
  const [isSubmittingVerification, setIsSubmittingVerification] = useState(false);

  const mockInstitutionId = '11111111-1111-4111-a111-111111111111';
  const mockMemberId = 'student-membership-001';

  const fetchIncident = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/incidents/${incidentId}`, {
        headers: {
          'x-institution-id': mockInstitutionId,
          'x-member-id': mockMemberId,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to load incident');
      }
      setIncident(data.data.incident);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error loading details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncident();
  }, [incidentId]);

  const handleClarificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!incident) return;
    setIsSubmittingClarification(true);

    try {
      const res = await fetch(`/api/incidents/${incident.id}/clarifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-member-id': mockMemberId,
        },
        body: JSON.stringify({
          answer: clarificationAnswer,
          expectedVersion: incident.version,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to submit answer');
      setClarificationAnswer('');
      await fetchIncident();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed');
    } finally {
      setIsSubmittingClarification(false);
    }
  };

  const handleVerificationDecision = async (decision: 'accepted' | 'rejected') => {
    if (!incident) return;
    if (decision === 'rejected' && !verificationReason.trim()) {
      alert('Please provide a specific reason why the issue is not fixed.');
      return;
    }

    setIsSubmittingVerification(true);
    try {
      const res = await fetch(`/api/incidents/${incident.id}/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-member-id': mockMemberId,
          'x-member-roles': 'student,cr',
        },
        body: JSON.stringify({
          decision,
          reason: decision === 'accepted' ? 'Verified working by reporter.' : verificationReason,
          evidenceVersion: 1,
          expectedVersion: incident.version,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to confirm');
      setVerificationReason('');
      await fetchIncident();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Confirmation error');
    } finally {
      setIsSubmittingVerification(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto p-8 text-center text-gray-500">
        <div className="animate-spin text-3xl mb-2">⚙️</div>
        Loading incident details...
      </div>
    );
  }

  if (errorMsg || !incident) {
    return (
      <div className="max-w-3xl mx-auto p-8">
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
          <h2 className="font-bold">Unable to display incident</h2>
          <p className="text-sm mt-1">{errorMsg || 'Not found or access denied.'}</p>
          <Link href="/student" className="mt-3 inline-block text-xs font-semibold text-red-800 underline">
            ← Back to Campus Feed
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* Header breadcrumb */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <Link href="/student" className="hover:text-indigo-600 font-medium">
          ← Back to Incident Feed
        </Link>
        <span className="font-mono">Ref: {incident.id.slice(0, 8)}</span>
      </div>

      {/* Main card */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-100 text-indigo-800">
              {incident.state.replace(/_/g, ' ')}
            </span>
            <h1 className="text-2xl font-extrabold text-gray-900 mt-2">{incident.description}</h1>
            <p className="text-sm text-gray-600 mt-1 flex items-center gap-1.5">
              <span>📍</span>
              <span className="font-medium">{incident.locationText}</span>
            </p>
          </div>

          <div className="text-right">
            <div className="text-2xl font-black text-indigo-600">▲ {incident.voteCount}</div>
            <div className="text-[10px] text-gray-400 uppercase tracking-wider">Student Impact Votes</div>
          </div>
        </div>

        {/* AI Triage Diagnosis */}
        {incident.triageSummary && (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <span>🤖</span>
              <span>ORION AI Triage Analysis</span>
            </div>
            <p className="text-slate-600">{incident.triageSummary}</p>
          </div>
        )}

        {/* Clarification Drawer */}
        {incident.state === 'needs_clarification' && incident.clarificationRequest && (
          <div className="p-5 bg-amber-50 border border-amber-300 rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
              <span>⚠️</span>
              <span>Clarification Required to Proceed with Dispatch</span>
            </div>
            <p className="text-xs text-amber-800">{incident.clarificationRequest.question}</p>

            <form onSubmit={handleClarificationSubmit} className="space-y-2">
              <input
                type="text"
                required
                value={clarificationAnswer}
                onChange={(e) => setClarificationAnswer(e.target.value)}
                placeholder="Type your response (e.g. Room 302, 3rd Floor next to elevator)..."
                className="w-full px-3 py-2 border border-amber-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-amber-500 bg-white"
              />
              <button
                type="submit"
                disabled={isSubmittingClarification || !clarificationAnswer.trim()}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg text-xs transition"
              >
                {isSubmittingClarification ? 'Submitting...' : 'Submit Clarification'}
              </button>
            </form>
          </div>
        )}

        {/* Reporter Verification Drawer (C1) */}
        {incident.state === 'submitted_for_verification' && (
          <div className="p-5 bg-emerald-50 border border-emerald-300 rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
              <span>🔍</span>
              <span>Staff Marked Issue as Fixed — Reporter Confirmation Needed</span>
            </div>
            <p className="text-xs text-emerald-800">
              Staff technicians have submitted physical repair evidence. Please inspect the location and confirm if the issue is completely resolved. Staff submission alone does not close this ticket.
            </p>

            <div className="space-y-2 pt-2">
              <input
                type="text"
                value={verificationReason}
                onChange={(e) => setVerificationReason(e.target.value)}
                placeholder="Optional notes or reason if rejecting (e.g. Projector turns on but color is still distorted)..."
                className="w-full px-3 py-2 border border-emerald-200 rounded-lg text-xs bg-white outline-none focus:ring-2 focus:ring-emerald-500"
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={isSubmittingVerification}
                  onClick={() => handleVerificationDecision('accepted')}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition flex-1"
                >
                  ✓ Accept & Close Incident
                </button>
                <button
                  type="button"
                  disabled={isSubmittingVerification}
                  onClick={() => handleVerificationDecision('rejected')}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs transition flex-1"
                >
                  ✕ Reject & Reopen (Triggers Replanning)
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
