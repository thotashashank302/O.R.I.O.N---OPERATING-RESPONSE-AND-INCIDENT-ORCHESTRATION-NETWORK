'use client';

import React, { useState } from 'react';
import ReportForm from '@/features/reporting/components/ReportForm';

export default function ClubReportingPage() {
  const [clubName, setClubName] = useState('Robotics & AI Club');
  const mockInstitutionId = '11111111-1111-4111-a111-111111111111';
  const mockMemberId = 'president-club-001';

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

      <div className="p-4 bg-white rounded-xl border border-gray-200">
        <label className="block text-xs font-semibold text-gray-700 mb-1">
          Recognized Student Body
        </label>
        <select
          value={clubName}
          onChange={(e) => setClubName(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-gray-50 outline-none"
        >
          <option>Robotics & AI Club</option>
          <option>Coding & Open Source Forum</option>
          <option>Cultural & Literary Society</option>
        </select>
      </div>

      <ReportForm
        institutionId={mockInstitutionId}
        memberId={mockMemberId}
        defaultScope="club"
      />
    </div>
  );
}
