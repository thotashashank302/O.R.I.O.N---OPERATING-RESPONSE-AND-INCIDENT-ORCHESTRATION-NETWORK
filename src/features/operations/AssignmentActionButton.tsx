"use client";

import { useState } from "react";
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

  return (
    <div>
      <button
        type="button"
        disabled={submitting}
        onClick={async () => {
          setSubmitting(true);
          setError(null);
          try {
            const response = await fetch(`/api/assignments/${assignmentId}/actions`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action, expected_version: version }),
            });
            if (!response.ok) {
              const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
              throw new Error(payload?.error?.message ?? "The assignment changed. Refresh and try again.");
            }
            router.refresh();
          } catch (reason: unknown) {
            setError(reason instanceof Error ? reason.message : "The action could not be completed.");
          } finally {
            setSubmitting(false);
          }
        }}
        className={`rounded-lg border px-4 py-2 text-xs font-semibold transition-colors disabled:cursor-wait disabled:opacity-55 ${COLOR_CLASS[color]}`}
      >
        {submitting ? "Working…" : label}
      </button>
      {error && <p className="mt-2 max-w-xs text-xs text-red-700" role="alert">{error}</p>}
    </div>
  );
}
