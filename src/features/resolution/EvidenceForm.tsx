"use client";

/**
 * ORION — Evidence Submission Form
 * Developer 4 (Anjali) owns this file.
 *
 * Collects:
 * - Repair notes (text)
 * - Functional test results (text)
 * - Optional private photo references (from D3's upload service)
 *
 * Provides "Submit for Verification" only — never an unrestricted Resolve button.
 * Internal issues require functional test information.
 */

import { useState, useTransition } from "react";
import type { EvidenceKind, Task } from "@/contracts/operations";

interface EvidenceFormProps {
  taskId: string;
  assignmentId: string;
  assignmentVersion: number;
  task: Task;
  incidentCategory: string;
  onSuccess?: () => void;
}

interface EvidenceEntry {
  kind: EvidenceKind;
  content: string;
  storageKey?: string;
}

export function EvidenceForm({
  taskId,
  assignmentId,
  assignmentVersion,
  task,
  incidentCategory,
  onSuccess,
}: EvidenceFormProps) {
  const [notes, setNotes] = useState("");
  const [testResult, setTestResult] = useState("");
  const [photoKey, setPhotoKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isPhysicalCategory = /electrical|fan|ac|door|key|security|emergency|safety|plumbing/i.test(
    incidentCategory
  );

  async function submitEvidence(entry: EvidenceEntry) {
    const res = await fetch(`/api/tasks/${taskId}/evidence`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: entry.kind,
        content: entry.content,
        storage_key: entry.storageKey,
        task_id: taskId,
        expected_assignment_version: assignmentVersion,
      }),
    });

    const json = await res.json();

    if (!res.ok) {
      throw new Error(json.error?.message ?? "Failed to submit evidence");
    }

    return json.data;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (notes.trim().length < 10 || testResult.trim().length < 10) {
      setError("Completion notes and functional test results must each contain at least 10 characters");
      return;
    }

    startTransition(async () => {
      try {
        const submissions: Promise<unknown>[] = [];

        if (notes.trim()) {
          submissions.push(submitEvidence({ kind: "note", content: notes.trim() }));
        }

        if (testResult.trim()) {
          submissions.push(
            submitEvidence({ kind: "test_result", content: testResult.trim() })
          );
        }

        if (photoKey.trim()) {
          submissions.push(
            submitEvidence({
              kind: "photo",
              content: "Photo evidence attached",
              storageKey: photoKey.trim(),
            })
          );
        }

        await Promise.all(submissions);

        // Now trigger the submit action on the assignment
        const actionRes = await fetch(`/api/assignments/${assignmentId}/actions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "submit",
            expected_version: assignmentVersion,
          }),
        });

        if (!actionRes.ok) {
          const actionJson = await actionRes.json();
          throw new Error(actionJson.error?.message ?? "Failed to submit for verification");
        }

        setSuccessMsg("Submitted for verification. A verifier will review your evidence.");
        setNotes("");
        setTestResult("");
        setPhotoKey("");
        onSuccess?.();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Submission failed");
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-2xl border border-slate-700/50 bg-slate-800/50 p-6 backdrop-blur-sm"
    >
      <div>
        <h3 className="text-base font-semibold text-white">Submit Evidence</h3>
        <p className="mt-1 text-xs text-slate-400">
          Provide completion notes and test results. Photos are private and visible only to human reviewers.
        </p>
      </div>

      {/* Checklist reminder */}
      {task.checklist.length > 0 && (
        <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Required Checklist
          </p>
          <ul className="space-y-1">
            {task.checklist.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                <span className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border border-slate-600 bg-slate-800" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Repair Note */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-300">
          Repair / Completion Note{" "}
          <span className="text-slate-500">(required)</span>
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Describe what was done, parts replaced, observations…"
          rows={4}
          className="w-full resize-none rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-200 placeholder-slate-600 transition-colors focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
        />
      </div>

      {/* Functional Test Result */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-300">
          Functional Test Result
          {isPhysicalCategory && (
            <span className="ml-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-400">
              Required for physical issues
            </span>
          )}
        </label>
        <textarea
          value={testResult}
          onChange={(e) => setTestResult(e.target.value)}
          placeholder="e.g. Fan running at all speeds, no noise, power cycle confirmed…"
          rows={3}
          className="w-full resize-none rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-200 placeholder-slate-600 transition-colors focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
        />
      </div>

      {/* Private Photo Reference */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-300">
          Photo Evidence Key
          <span className="ml-2 text-xs text-slate-500">(optional — from upload service)</span>
        </label>
        <input
          type="text"
          value={photoKey}
          onChange={(e) => setPhotoKey(e.target.value)}
          placeholder="private-storage-key from upload service"
          className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-200 placeholder-slate-600 transition-colors focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
        />
        <p className="mt-1 text-xs text-slate-500">
          Photos are private evidence for human reviewers only. The AI model does not process images.
        </p>
      </div>

      {/* Physical category warning */}
      {isPhysicalCategory && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-sm text-amber-300">
            ⚠️ <strong>Human verification required.</strong> Even after submitting evidence, a designated verifier must physically confirm this work. Functional tests are mandatory.
          </p>
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </p>
      )}

      {successMsg && (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
          {successMsg}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-xl border border-cyan-500/30 bg-cyan-500/10 py-3 text-sm font-semibold text-cyan-300 transition-all hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Submitting…" : "Submit for Verification"}
      </button>

      <p className="text-center text-xs text-slate-600">
        This submits your work for human verification — it does not resolve the incident.
      </p>
    </form>
  );
}
