'use client';

import ReportForm from '@/features/reporting/components/ReportForm';
import { useActiveContext } from '@/features/identity/use-active-context';

export default function TransportReportingPage() {
  const contextState = useActiveContext();
  const context = contextState.activeContext;
  if (!context) return <div className="p-8 text-center text-stone-500">{contextState.error ?? 'Loading transport context…'}</div>;

  return (
    <div className="space-y-6 px-4 py-8 sm:px-8 max-w-3xl">
      <div className="rounded-2xl border border-stone-200 bg-white/80 p-6">
        <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-700 font-semibold">
          Special Scope: Transport Service
        </span>
        <h1 className="text-xl font-bold mt-1">Campus Transit Incident Reporting</h1>
        <p className="text-xs text-stone-500 mt-1">
          Lodge issues regarding campus buses, delays, route hazards, or driver assistance for verified transit riders.
        </p>
      </div>

      <div className="p-4 bg-white/80 rounded-xl border border-stone-200 text-sm text-stone-600">
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
