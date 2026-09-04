'use client';

import React, { useState } from 'react';
import ReportForm from '@/features/reporting/components/ReportForm';

export default function TransportReportingPage() {
  const [routeNumber, setRouteNumber] = useState('Route 12 - North Corridor');
  const mockInstitutionId = '11111111-1111-4111-a111-111111111111';
  const mockMemberId = 'student-transport-001';

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

      <div className="p-4 bg-white rounded-xl border border-gray-200">
        <label className="block text-xs font-semibold text-gray-700 mb-1">
          Enrolled Bus Route
        </label>
        <select
          value={routeNumber}
          onChange={(e) => setRouteNumber(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-gray-50 outline-none"
        >
          <option>Route 12 - North Corridor (Bus KA-04-1234)</option>
          <option>Route 05 - Metro Link (Bus KA-04-5678)</option>
          <option>Route 09 - South Express (Bus KA-04-9012)</option>
        </select>
      </div>

      <ReportForm
        institutionId={mockInstitutionId}
        memberId={mockMemberId}
        defaultScope="transport"
      />
    </div>
  );
}
