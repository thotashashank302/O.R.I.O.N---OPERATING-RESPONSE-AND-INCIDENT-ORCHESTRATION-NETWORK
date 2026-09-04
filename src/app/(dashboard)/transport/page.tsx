'use client';

import ReportForm from '@/features/reporting/components/ReportForm';
import { useActiveContext } from '@/features/identity/use-active-context';

export default function TransportReportingPage() {
  const contextState = useActiveContext();
  const context = contextState.activeContext;
  if (!context) return <div className="p-8 text-center text-gray-500">{contextState.error ?? 'Loading transport context…'}</div>;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="bg-emerald-900 text-white p-6 rounded-2xl">
        <span className="text-xs font-mono uppercase tracking-wider text-emerald-300">
          Special Scope: Transport Service
        </span>
        <h1 className="text-2xl font-bold mt-1">Campus Transit Incident Reporting</h1>
        <p className="text-xs text-emerald-100 mt-1">
          Lodge issues regarding campus buses, delays, route hazards, or driver assistance for verified transit riders.
        </p>
      </div>

      <div className="p-4 bg-white rounded-xl border border-gray-200 text-sm text-gray-600">
        Reports are scoped to your active, administrator-verified transport enrollment.
      </div>

      <ReportForm
        institutionId={context.institution_id}
        memberId={context.membership_id}
        defaultScope="transport"
      />
    </div>
  );
}
