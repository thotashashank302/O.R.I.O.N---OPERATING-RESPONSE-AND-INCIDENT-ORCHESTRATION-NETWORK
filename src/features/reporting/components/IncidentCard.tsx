'use client';

import React from 'react';
import Link from 'next/link';
import IncidentVoteButton from '@/features/voting/components/IncidentVoteButton';

export interface IncidentSummaryProps {
  incident: {
    id: string;
    category: string;
    description: string;
    locationText: string;
    visibility: string;
    isConfidential: boolean;
    state: string;
    voteCount: number;
    hasVoted?: boolean;
    createdAt: string;
    clarificationRequest?: {
      question: string;
    } | null;
  };
  institutionId: string;
  memberId: string;
}

const STATE_BADGES: Record<string, { label: string; color: string }> = {
  reported: { label: 'Reported', color: 'bg-blue-100 text-blue-800' },
  triaging: { label: 'Triaging', color: 'bg-indigo-100 text-indigo-800' },
  needs_clarification: { label: 'Clarification Needed', color: 'bg-amber-100 text-amber-800' },
  planned: { label: 'Planned', color: 'bg-cyan-100 text-cyan-800' },
  assigned: { label: 'Assigned', color: 'bg-purple-100 text-purple-800' },
  in_progress: { label: 'In Progress', color: 'bg-orange-100 text-orange-800' },
  submitted_for_verification: { label: 'Pending Verification', color: 'bg-emerald-100 text-emerald-800 animate-pulse' },
  resolved: { label: 'Resolved', color: 'bg-green-100 text-green-800' },
  reopened: { label: 'Reopened', color: 'bg-rose-100 text-rose-800' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-800' },
};

export default function IncidentCard({ incident, institutionId, memberId }: IncidentSummaryProps) {
  const badge = STATE_BADGES[incident.state] || { label: incident.state, color: 'bg-gray-100 text-gray-800' };

  return (
    <div className="p-5 bg-white rounded-xl border border-gray-200 hover:border-gray-300 shadow-sm transition space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${badge.color}`}>
            {badge.label}
          </span>
          <span className="text-xs text-gray-500 font-mono">
            {incident.category.replace('_', ' ')}
          </span>
        </div>

        <span className="text-[11px] text-gray-400">
          {new Date(incident.createdAt).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>

      <div>
        <Link href={`/incidents/${incident.id}`} className="group">
          <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition text-base line-clamp-2">
            {incident.description}
          </h3>
        </Link>
        <p className="text-xs text-gray-600 mt-1 flex items-center gap-1">
          <span>📍</span>
          <span>{incident.locationText}</span>
        </p>
      </div>

      {incident.clarificationRequest && (
        <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
          ⚠️ <strong>Action Needed:</strong> {incident.clarificationRequest.question}
        </div>
      )}

      <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
        <IncidentVoteButton
          incidentId={incident.id}
          initialVoteCount={incident.voteCount}
          initialHasVoted={incident.hasVoted}
          institutionId={institutionId}
          memberId={memberId}
          isConfidential={incident.isConfidential}
        />

        <Link
          href={`/incidents/${incident.id}`}
          className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
        >
          View Details →
        </Link>
      </div>
    </div>
  );
}
