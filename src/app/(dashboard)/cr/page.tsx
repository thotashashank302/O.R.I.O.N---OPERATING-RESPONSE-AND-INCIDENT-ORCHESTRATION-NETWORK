'use client';

import React, { useEffect, useState } from 'react';
import ReportForm from '@/features/reporting/components/ReportForm';
import IncidentCard from '@/features/reporting/components/IncidentCard';
import type { IncidentSummaryProps } from '@/features/reporting/components/IncidentCard';
import { orionContextHeaders, useActiveContext } from '@/features/identity/use-active-context';
import type { UserContextItem } from '@/contracts/identity';

type IncidentSummary = IncidentSummaryProps['incident'];

async function fetchIncidents(context: UserContextItem): Promise<IncidentSummary[]> {
  const response = await fetch('/api/incidents', {
    headers: orionContextHeaders(context),
  });
  const payload = (await response.json()) as { data?: { incidents?: IncidentSummary[] } };
  return response.ok && payload.data?.incidents ? payload.data.incidents : [];
}

export default function CRDashboardPage() {
  const [incidents, setIncidents] = useState<IncidentSummary[]>([]);
  const [showReportModal, setShowReportModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const contextState = useActiveContext();
  const activeContext = contextState.activeContext;

  const loadIncidents = async () => {
    try {
      setLoading(true);
      if (activeContext) setIncidents(await fetchIncidents(activeContext));
    } catch (err) {
      console.error('Failed to load incidents', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    if (!activeContext) return;
    fetchIncidents(activeContext)
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
  }, [activeContext]);

  if (contextState.loading || !activeContext) {
    return <div className="p-8 text-center text-stone-500">{contextState.error ?? 'Loading your class context…'}</div>;
  }

  const pendingVerificationIncidents = incidents.filter(
    (i) => i.state === 'submitted_for_verification'
  );

  return (
    <div className="space-y-6 px-4 py-8 sm:px-8">
      {/* Header — warm institutional */}
      <div className="rounded-2xl border border-stone-200 bg-white/80 p-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <span className="px-2.5 py-0.5 rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200 font-mono text-[10px] uppercase tracking-wider font-semibold">
            Class Representative Portal
          </span>
          <h1 className="text-xl font-bold mt-2">Classroom & Section Coordination</h1>
          <p className="text-xs text-stone-500 mt-1">
            Authorized to lodge routine class infrastructure requests and verify technician physical repairs.
          </p>
        </div>

        <button
          onClick={() => setShowReportModal(true)}
          className="px-4 py-2.5 bg-stone-800 hover:bg-stone-700 font-bold text-white rounded-xl text-xs transition"
        >
          + Report Class Issue
        </button>
      </div>

      {/* CR Verifications Section */}
      <div id="verification" className="scroll-mt-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold flex items-center gap-2">
            <span>📋 Verification Desk</span>
            {pendingVerificationIncidents.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 animate-pulse">
                {pendingVerificationIncidents.length} Pending
              </span>
            )}
          </h2>
        </div>

        {pendingVerificationIncidents.length > 0 ? (
          <div className="p-5 bg-emerald-50/80 border border-emerald-200 rounded-2xl space-y-3">
            <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
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
                  institutionId={activeContext.institution_id}
                  memberId={activeContext.membership_id}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="p-6 text-center rounded-2xl border border-dashed border-stone-300 bg-stone-50/70 space-y-2">
            <span className="text-2xl">🔍</span>
            <p className="text-xs font-semibold text-stone-700">No Repairs Awaiting CR Verification</p>
            <p className="text-[11px] text-stone-500 max-w-md mx-auto">
              When technicians complete assigned repairs and submit photographic or diagnostic evidence, they will appear here for you to verify physical classroom functionality before tickets can close.
            </p>
          </div>
        )}
      </div>

      {/* Routine issues stream */}
      <div id="incidents" className="scroll-mt-6 space-y-3">
        <h2 className="text-base font-bold">All Classroom & Department Issues</h2>
        {loading ? (
          <div className="text-center py-8 text-stone-400 text-sm">Loading department feed...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {incidents.map((incident) => (
              <IncidentCard
                key={incident.id}
                incident={incident}
                institutionId={activeContext.institution_id}
                memberId={activeContext.membership_id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative w-full max-w-xl my-8">
            <button
              onClick={() => setShowReportModal(false)}
              className="absolute top-4 right-4 z-10 text-stone-400 hover:text-stone-600 font-bold text-lg"
            >
              ✕
            </button>
            <ReportForm
              institutionId={activeContext.institution_id}
              memberId={activeContext.membership_id}
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
