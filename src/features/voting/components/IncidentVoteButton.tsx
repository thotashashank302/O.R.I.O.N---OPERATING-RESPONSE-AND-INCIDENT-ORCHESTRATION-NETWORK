'use client';

import React, { useState } from 'react';

interface IncidentVoteButtonProps {
  incidentId: string;
  initialVoteCount: number;
  initialHasVoted?: boolean;
  institutionId: string;
  memberId: string;
  isConfidential?: boolean;
}

export default function IncidentVoteButton({
  incidentId,
  initialVoteCount,
  initialHasVoted = false,
  institutionId,
  memberId,
  isConfidential = false,
}: IncidentVoteButtonProps) {
  const [voteCount, setVoteCount] = useState(initialVoteCount);
  const [hasVoted, setHasVoted] = useState(initialHasVoted);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (isConfidential) {
    return (
      <span className="text-xs text-gray-400 italic bg-gray-50 px-2 py-1 rounded">
        Voting excluded (confidential)
      </span>
    );
  }

  const handleToggleVote = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);

    try {
      const method = hasVoted ? 'DELETE' : 'PUT';
      const res = await fetch(`/api/incidents/${incidentId}/vote`, {
        method,
        headers: {
          'x-orion-institution-id': institutionId,
          'x-orion-membership-id': memberId,
        },
      });

      const json = await res.json();
      if (!res.ok || !json.data) throw new Error(json.error?.message ?? "The vote could not be updated");
      setVoteCount(json.data.voteCount);
      setHasVoted(json.data.hasVoted);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The vote could not be updated. Please retry.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <span className="inline-flex flex-col items-start gap-1">
    <button
      type="button"
      onClick={handleToggleVote}
      disabled={isLoading}
      title="Signal student impact (measures severity for resolution prioritizing)"
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition border ${
        hasVoted
          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
          : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-400 hover:text-indigo-600'
      }`}
    >
      <span>▲</span>
      <span>{voteCount}</span>
      <span className="text-[10px] font-normal opacity-80">{hasVoted ? 'Voted' : 'Vote'}</span>
    </button>
    {error && <span role="alert" className="text-xs text-red-700">{error}</span>}
    </span>
  );
}
