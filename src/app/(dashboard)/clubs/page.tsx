'use client';

import ReportForm from '@/features/reporting/components/ReportForm';
import { useActiveContext } from '@/features/identity/use-active-context';

export default function ClubReportingPage() {
  const contextState = useActiveContext();
  const context = contextState.activeContext;
  if (!context) return <div className="p-8 text-center text-stone-500">{contextState.error ?? 'Loading club context…'}</div>;

  return (
    <div className="space-y-6 px-4 py-8 sm:px-8 max-w-3xl">
      <div className="rounded-2xl border border-stone-200 bg-white/80 p-6">
        <span className="text-[10px] font-mono uppercase tracking-wider text-purple-700 font-semibold">
          Special Scope: Student Clubs & Events
        </span>
        <h1 className="text-xl font-bold mt-1">Club Facility & Event Space Request</h1>
        <p className="text-xs text-stone-500 mt-1">
          Authorized club coordinators can report auditorium AV issues, seminar hall booking conflicts, or equipment needs.
        </p>
      </div>

      <div className="p-4 bg-white/80 rounded-xl border border-stone-200 text-sm text-stone-600">
        Reports are scoped to the active club term attached to your current president or coordinator role.
      </div>

      <ReportForm
        institutionId={context.institution_id}
        memberId={context.membership_id}
        defaultScope="club"
      />
    </div>
  );
}
