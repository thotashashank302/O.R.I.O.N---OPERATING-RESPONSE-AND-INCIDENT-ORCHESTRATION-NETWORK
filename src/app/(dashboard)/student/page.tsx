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

export default function StudentDashboardPage() {
  const [showReportModal, setShowReportModal] = useState(false);
  const [incidents, setIncidents] = useState<IncidentSummary[]>([]);
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
    return <div className="p-8 text-center text-stone-500">{contextState.error ?? 'Loading your campus context…'}</div>;
  }

  return (
    <div className="space-y-6 px-4 py-8 sm:px-8">
      {/* Top Banner — warm institutional style */}
      <div className="flex items-center justify-between gap-4 rounded-2xl border border-stone-200 bg-white/80 p-6">
        <div>
          <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-cyan-700">
            Student Incident Portal
          </span>
          <h1 className="text-xl font-bold mt-1">Campus Operations & Issue Feed</h1>
          <p className="text-xs text-stone-500 mt-1 max-w-xl">
            Report infrastructure faults, track real-time resolution, and vote on existing issues to signal student impact.
          </p>
        </div>
        <button
          onClick={() => setShowReportModal(true)}
          className="px-5 py-3 bg-stone-800 text-white hover:bg-stone-700 font-bold rounded-xl shadow transition whitespace-nowrap text-sm"
        >
          + Report Issue
        </button>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white/80 p-4 rounded-xl border border-stone-200">
          <div className="text-2xl font-bold">{incidents.length}</div>
          <div className="text-xs text-stone-500 mt-0.5">Total Active Issues</div>
        </div>
        <div className="bg-white/80 p-4 rounded-xl border border-stone-200">
          <div className="text-2xl font-bold text-amber-700">
            {incidents.filter((i) => i.state === 'needs_clarification').length}
          </div>
          <div className="text-xs text-stone-500 mt-0.5">Awaiting Clarification</div>
        </div>
        <div className="bg-white/80 p-4 rounded-xl border border-stone-200">
          <div className="text-2xl font-bold text-cyan-700">
            {incidents.filter((i) => i.state === 'in_progress').length}
          </div>
          <div className="text-xs text-stone-500 mt-0.5">In Repair / Progress</div>
        </div>
        <div className="bg-white/80 p-4 rounded-xl border border-stone-200">
          <div className="text-2xl font-bold text-emerald-700">
            {incidents.filter((i) => i.state === 'submitted_for_verification').length}
          </div>
          <div className="text-xs text-stone-500 mt-0.5">Pending Verification</div>
        </div>
      </div>

      {/* Main Feed */}
      <div id="incidents" className="scroll-mt-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Campus Issue Tracker</h2>
          <button
            onClick={loadIncidents}
            className="text-xs text-cyan-700 hover:text-cyan-800 font-medium"
          >
            ↻ Refresh Feed
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-stone-400">Loading campus feed...</div>
        ) : incidents.length === 0 ? (
          <div className="text-center py-12 bg-white/80 rounded-2xl border border-stone-200 p-8">
            <div className="text-4xl mb-2">🎉</div>
            <h3 className="font-bold">No active incidents reported</h3>
            <p className="text-xs text-stone-500 mt-1">All classroom and facility systems are operational.</p>
          </div>
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

      {/* Report Modal */}
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
