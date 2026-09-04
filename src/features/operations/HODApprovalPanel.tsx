"use client";

/**
 * ORION — HOD Approval Panel Component
 * Developer 4 (Anjali) owns this file.
 *
 * Renders an approval/rejection form for a pending action.
 * Tied to specific action_payload_hash + plan_version — a new plan version
 * invalidates existing approvals.
 *
 * Prevents:
 * - Self-approval
 * - Stale plan version approval
 * - High-risk physical/security autonomous AI approval
 */

import { useState, useTransition } from "react";
import type { Approval } from "@/contracts/operations";

interface HODApprovalPanelProps {
  approvalId: string;
  actionDescription: string;
  actionPayloadHash: string;
  planVersion: number;
  requestedByName: string;
  isHighRiskPhysical?: boolean;
  onDecision?: (decision: "approve" | "reject") => void;
}

export function HODApprovalPanel({
  approvalId,
  actionDescription,
  actionPayloadHash,
  planVersion,
  requestedByName,
  isHighRiskPhysical = false,
  onDecision,
}: HODApprovalPanelProps) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [decided, setDecided] = useState<"approve" | "reject" | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleDecision(decision: "approve" | "reject") {
    if (!reason.trim() && decision === "reject") {
      setError("A reason is required when rejecting");
      return;
    }

    setError(null);

    startTransition(async () => {
      try {
        const res = await fetch(`/api/approvals/${approvalId}/decision`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            decision,
            action_payload_hash: actionPayloadHash,
            plan_version: planVersion,
            reason: reason.trim() || undefined,
          }),
        });

        const json = await res.json();

        if (!res.ok) {
          if (json.error?.code === "SELF_APPROVAL_CONFLICT") {
            setError("You cannot approve your own action.");
          } else if (json.error?.code === "STALE_PLAN_VERSION") {
            setError("The plan was updated — this approval is no longer valid. Please review the new plan.");
          } else {
            setError(json.error?.message ?? "Failed to record decision");
          }
          return;
        }

        setDecided(decision);
        onDecision?.(decision);
      } catch {
        setError("Network error — please try again");
      }
    });
  }

  if (decided) {
    return (
      <div
        className={`rounded-2xl border p-5 ${
          decided === "approve"
            ? "border-emerald-500/30 bg-emerald-500/10"
            : "border-red-500/30 bg-red-500/10"
        }`}
      >
        <p
          className={`text-sm font-semibold ${
            decided === "approve" ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {decided === "approve" ? "✓ Approved" : "✗ Rejected"}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Decision recorded with audit trail.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-800/50 p-5 backdrop-blur-sm">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-white">Pending Approval</h4>
          <p className="mt-0.5 text-xs text-slate-500">
            Requested by <span className="text-slate-300">{requestedByName}</span>
          </p>
        </div>
        <span className="rounded-full border border-slate-600 px-2 py-0.5 text-xs text-slate-400">
          Plan v{planVersion}
        </span>
      </div>

      {/* Action description */}
      <div className="mb-4 rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-3">
        <p className="text-sm text-slate-300">{actionDescription}</p>
        <p className="mt-1.5 font-mono text-xs text-slate-600 break-all">
          Hash: {actionPayloadHash.slice(0, 16)}…
        </p>
      </div>

      {/* High-risk physical warning */}
      {isHighRiskPhysical && (
        <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 p-4">
          <p className="text-sm font-semibold text-red-400">
            🔒 High-Risk Physical / Security Action
          </p>
          <p className="mt-1 text-xs text-red-300/80">
            This action involves physical infrastructure or security controls.
            Only approve if you have personally verified the situation and qualified
            personnel are ready to execute. AI cannot authorize physical access or
            electrical operations.
          </p>
        </div>
      )}

      {/* Reason input */}
      <div className="mb-4">
        <label className="mb-1.5 block text-sm font-medium text-slate-300">
          Reason{" "}
          <span className="text-slate-500">(required for rejection)</span>
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Optional for approval, required for rejection…"
          rows={3}
          className="w-full resize-none rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
        />
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-400">
          {error}
        </p>
      )}

      {/* Decision buttons */}
      <div className="flex gap-3">
        <button
          onClick={() => handleDecision("reject")}
          disabled={isPending}
          className="flex-1 rounded-xl border border-red-500/30 bg-red-500/10 py-3 text-sm font-semibold text-red-400 transition-all hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "…" : "Reject"}
        </button>
        <button
          onClick={() => handleDecision("approve")}
          disabled={isPending}
          className="flex-1 rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-3 text-sm font-semibold text-emerald-400 transition-all hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "…" : "Approve"}
        </button>
      </div>

      <p className="mt-3 text-center text-xs text-slate-600">
        Approval is tied to plan version {planVersion}. A plan update will invalidate this decision.
      </p>
    </div>
  );
}
