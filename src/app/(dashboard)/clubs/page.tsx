'use client';

import ReportForm from '@/features/reporting/components/ReportForm';
import { useActiveContext } from '@/features/identity/use-active-context';

export default function ClubReportingPage() {
  const contextState = useActiveContext();
  const context = contextState.activeContext;
  if (!context) return <div className="p-8 text-center text-gray-500">{contextState.error ?? 'Loading club context…'}</div>;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="bg-purple-900 text-white p-6 rounded-2xl">
        <span className="text-xs font-mono uppercase tracking-wider text-purple-300">
          Special Scope: Student Clubs & Events
        </span>
        <h1 className="text-2xl font-bold mt-1">Club Facility & Event Space Request</h1>
        <p className="text-xs text-purple-100 mt-1">
          Authorized club coordinators can report auditorium AV issues, seminar hall booking conflicts, or equipment needs.
        </p>
      </div>

      <div className="p-4 bg-white rounded-xl border border-gray-200 text-sm text-gray-600">
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
