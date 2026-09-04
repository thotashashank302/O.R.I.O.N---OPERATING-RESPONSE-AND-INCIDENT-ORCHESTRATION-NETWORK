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
    return <div className="p-8 text-center text-gray-500">{contextState.error ?? 'Loading your campus context…'}</div>;
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Top Banner */}
      <div className="flex items-center justify-between gap-4 bg-gradient-to-r from-indigo-900 to-indigo-700 text-white p-6 rounded-2xl shadow-sm">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-indigo-300">
            Student Incident Portal
          </span>
          <h1 className="text-2xl font-black mt-1">Campus Operations & Issue Feed</h1>
          <p className="text-sm text-indigo-100 mt-1 max-w-xl">
            Report infrastructure faults, track real-time resolution, and vote on existing issues to signal student impact.
          </p>
        </div>

        <button
          onClick={() => setShowReportModal(true)}
          className="px-5 py-3 bg-white text-indigo-900 hover:bg-indigo-50 font-bold rounded-xl shadow transition whitespace-nowrap text-sm"
        >
          + Report Issue
        </button>
      </div>

      {/* Quick stats / categories bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <div className="text-2xl font-black text-gray-900">{incidents.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">Total Active Issues</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <div className="text-2xl font-black text-amber-600">
            {incidents.filter((i) => i.state === 'needs_clarification').length}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">Awaiting Clarification</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <div className="text-2xl font-black text-indigo-600">
            {incidents.filter((i) => i.state === 'in_progress').length}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">In Repair / Progress</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <div className="text-2xl font-black text-emerald-600">
            {incidents.filter((i) => i.state === 'submitted_for_verification').length}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">Pending Verification</div>
        </div>
      </div>

      {/* Main Feed */}
      <div id="incidents" className="scroll-mt-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Campus Issue Tracker</h2>
          <button
            onClick={loadIncidents}
            className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
          >
            ↻ Refresh Feed
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading campus feed...</div>
        ) : incidents.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-200 p-8">
            <div className="text-4xl mb-2">🎉</div>
            <h3 className="font-bold text-gray-800">No active incidents reported</h3>
            <p className="text-xs text-gray-500 mt-1">All classroom and facility systems are operational.</p>
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
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative w-full max-w-xl my-8">
            <button
              onClick={() => setShowReportModal(false)}
              className="absolute top-4 right-4 z-10 text-gray-400 hover:text-gray-600 font-bold text-lg"
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
