"use client";

import { useCallback, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const COLOR_CLASS = {
  cyan: "border-cyan-300 bg-cyan-50 text-cyan-700 hover:bg-cyan-100",
  emerald: "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
  amber: "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100",
  red: "border-red-300 bg-red-50 text-red-700 hover:bg-red-100",
} as const;

export function AssignmentActionButton({
  assignmentId,
  action,
  version,
  label,
  color,
}: {
  assignmentId: string;
  action: string;
  version: number;
  label: string;
  color: keyof typeof COLOR_CLASS;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [reasonOpen, setReasonOpen] = useState(false);
  const [reason, setReason] = useState("");
  const reasonId = useId();
  const focusReason = useCallback((element: HTMLTextAreaElement | null) => { element?.focus(); }, []);
  const trigger = useRef<HTMLButtonElement>(null);
  const needsReason = action === "handover" || action === "block";

  function closeReason() {
    setReasonOpen(false);
    setReason("");
    setError(null);
    trigger.current?.focus();
  }

  async function submitAction() {
    if (submitting || (needsReason && !reason.trim())) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/assignments/${assignmentId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, expected_version: version, reason: needsReason ? reason.trim() : undefined }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(payload?.error?.message ?? "The assignment changed. Refresh and try again.");
      }
      closeReason();
      router.refresh();
    } catch (failure: unknown) {
      setError(failure instanceof Error ? failure.message : "The action could not be completed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={reasonOpen ? "w-full min-w-0" : undefined}>
      <button
        ref={trigger}
        type="button"
        disabled={submitting}
        aria-expanded={needsReason ? reasonOpen : undefined}
        aria-controls={needsReason ? `${reasonId}-form` : undefined}
        onClick={() => {
          if (needsReason) {
            if (reasonOpen) closeReason();
            else { setError(null); setReasonOpen(true); }
          } else void submitAction();
        }}
        className={`rounded-lg border px-4 py-2 text-xs font-semibold transition-colors disabled:cursor-wait disabled:opacity-55 ${COLOR_CLASS[color]}`}
      >
        {submitting ? "Working…" : label}
      </button>
      {reasonOpen && (
        <form
          id={`${reasonId}-form`}
          className="mt-3 rounded-xl border border-stone-300 bg-stone-50 p-4 sm:p-5"
          onSubmit={(event) => { event.preventDefault(); void submitAction(); }}
          onKeyDown={(event) => {
            if (event.key === "Escape" && !submitting) { event.preventDefault(); closeReason(); }
          }}
          aria-busy={submitting}
        >
          <label htmlFor={reasonId} className="block text-sm font-semibold text-stone-800">
            {action === "handover" ? "Reason for handover" : "Reason work is blocked"}
          </label>
          <p id={`${reasonId}-help`} className="mt-1 text-xs leading-relaxed text-stone-600">
            Explain what prevents you from continuing and what the next person needs to know.
          </p>
          <textarea
            ref={focusReason}
            id={reasonId}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            required
            rows={3}
            disabled={submitting}
            aria-describedby={`${reasonId}-help`}
            placeholder="Describe the reason and any important work already completed."
            className="mt-3 block w-full resize-y rounded-lg border border-stone-400 bg-white px-3 py-2.5 text-sm text-stone-800 placeholder:text-stone-500 focus:border-amber-700 focus:outline-2 focus:outline-amber-700 disabled:opacity-60"
          />
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <button type="button" disabled={submitting} onClick={closeReason}
              className="rounded-lg border border-stone-300 px-4 py-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-100 disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={submitting || !reason.trim()}
              className="rounded-lg bg-stone-800 px-4 py-2.5 text-xs font-semibold text-stone-50 hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-50">
              {submitting ? "Submitting…" : "Submit request"}
            </button>
          </div>
        </form>
      )}
      {error && <p className="mt-2 max-w-prose text-xs text-red-700" role="alert">{error}</p>}
    </div>
  );
}
