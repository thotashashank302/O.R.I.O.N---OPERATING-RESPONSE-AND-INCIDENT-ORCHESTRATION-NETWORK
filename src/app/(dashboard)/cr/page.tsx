'use client';

import React, { useEffect, useState } from 'react';
import ReportForm from '@/features/reporting/components/ReportForm';
import IncidentCard from '@/features/reporting/components/IncidentCard';
import type { IncidentSummaryProps } from '@/features/reporting/components/IncidentCard';

type IncidentSummary = IncidentSummaryProps['incident'];

async function fetchIncidents(institutionId: string, memberId: string): Promise<IncidentSummary[]> {
  const response = await fetch('/api/incidents', {
    headers: {
      'x-institution-id': institutionId,
      'x-member-id': memberId,
    },
  });
  const payload = (await response.json()) as { data?: { incidents?: IncidentSummary[] } };
  return response.ok && payload.data?.incidents ? payload.data.incidents : [];
}

export default function CRDashboardPage() {
  const [incidents, setIncidents] = useState<IncidentSummary[]>([]);
  const [showReportModal, setShowReportModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const mockInstitutionId = '11111111-1111-4111-a111-111111111111';
  const mockCRMemberId = 'cr-membership-003';

  const loadIncidents = async () => {
    try {
      setLoading(true);
      setIncidents(await fetchIncidents(mockInstitutionId, mockCRMemberId));
    } catch (err) {
      console.error('Failed to load incidents', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    fetchIncidents(mockInstitutionId, mockCRMemberId)
      .then((nextIncidents) => {
        if (!cancelled) setIncidents(nextIncidents);
      })
      .catch((error: unknown) => {
        console.error('Failed to load incidents', error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const pendingVerificationIncidents = incidents.filter(
    (i) => i.state === 'submitted_for_verification'
  );

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl flex items-center justify-between flex-wrap gap-4">
        <div>
          <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono text-xs uppercase">
            Class Representative Portal
          </span>
          <h1 className="text-2xl font-black mt-1">Classroom & Section Coordination</h1>
          <p className="text-xs text-slate-400 mt-1">
            Authorized to lodge routine class infrastructure requests and verify technician physical repairs.
          </p>
        </div>

        <button
          onClick={() => setShowReportModal(true)}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 font-bold text-white rounded-xl text-xs transition"
        >
          + Report Class Issue
        </button>
      </div>

      {/* Pending CR Verifications Banner */}
      {pendingVerificationIncidents.length > 0 && (
        <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-3">
          <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
            <span>⚡</span>
            <span>
              {pendingVerificationIncidents.length} Issue(s) Repaired by Staff — Awaiting CR Verification
            </span>
          </div>
          <p className="text-xs text-emerald-700">
            Per campus operational policy, technician submission alone does not resolve incidents. Please verify physical functionality in your classroom and accept or reject with reason.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {pendingVerificationIncidents.map((inc) => (
              <IncidentCard
                key={inc.id}
                incident={inc}
                institutionId={mockInstitutionId}
                memberId={mockCRMemberId}
              />
            ))}
          </div>
        </div>
      )}

      {/* Routine issues stream */}
      <div className="space-y-3">
        <h2 className="text-base font-bold text-gray-900">All Classroom & Department Issues</h2>
        {loading ? (
          <div className="text-center py-8 text-gray-400 text-sm">Loading department feed...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {incidents.map((incident) => (
              <IncidentCard
                key={incident.id}
                incident={incident}
                institutionId={mockInstitutionId}
                memberId={mockCRMemberId}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative w-full max-w-xl my-8">
            <button
              onClick={() => setShowReportModal(false)}
              className="absolute top-4 right-4 z-10 text-gray-400 hover:text-gray-600 font-bold text-lg"
            >
              ✕
            </button>
            <ReportForm
              institutionId={mockInstitutionId}
              memberId={mockCRMemberId}
              defaultScope="cr"
              onSuccess={() => {
                loadIncidents();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
