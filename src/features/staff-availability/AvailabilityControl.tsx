"use client";

/**
 * ORION — Staff Availability Control Component
 * Developer 4 (Anjali) owns this file.
 *
 * Renders Available / Busy / Off duty toggle with:
 * - Optimistic UI that rolls back on failure
 * - Open-task handover modal when going Off duty
 * - Visual feedback on state changes
 */

import { useState, useOptimistic, useTransition } from "react";
import type { AvailabilityState, Assignment } from "@/contracts/operations";

interface AvailabilityControlProps {
  initialState: AvailabilityState;
  initialVersion: number;
  membershipId: string;
}

interface OpenTaskModalProps {
  tasks: Assignment[];
  onChoice: (choice: "keep" | "handover") => void;
  onCancel: () => void;
}

const STATE_CONFIG: Record<
  AvailabilityState,
  { label: string; color: string; bg: string; description: string }
> = {
  available: {
    label: "Available",
    color: "text-emerald-400",
    bg: "bg-emerald-500/20 border-emerald-500/50 hover:bg-emerald-500/30",
    description: "Eligible for new assignments",
  },
  busy: {
    label: "Busy",
    color: "text-amber-400",
    bg: "bg-amber-500/20 border-amber-500/50 hover:bg-amber-500/30",
    description: "Currently occupied — excluded from new routine work",
  },
  off_duty: {
    label: "Off Duty",
    color: "text-slate-400",
    bg: "bg-slate-500/20 border-slate-500/50 hover:bg-slate-500/30",
    description: "Not accepting any new work",
  },
};

function OpenTaskModal({ tasks, onChoice, onCancel }: OpenTaskModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        <h3 className="mb-2 text-lg font-semibold text-white">
          You have open tasks
        </h3>
        <p className="mb-4 text-sm text-slate-400">
          You have {tasks.length} active task{tasks.length !== 1 ? "s" : ""}.
          Going off duty without handling them will impact incident resolution.
        </p>

        <ul className="mb-6 space-y-2">
          {tasks.map((t) => (
            <li
              key={t.id}
              className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-300"
            >
              <span className="font-medium text-white">
                {t.incident?.title ?? t.task_id}
              </span>
              <span className="ml-2 rounded-full bg-slate-700 px-2 py-0.5 text-xs capitalize">
                {t.state}
              </span>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => onChoice("handover")}
            className="w-full rounded-xl border border-amber-500/40 bg-amber-500/10 py-3 text-sm font-medium text-amber-300 transition-all hover:bg-amber-500/20"
          >
            Request Handover
            <p className="mt-0.5 text-xs font-normal text-amber-400/70">
              Tasks stay with accountable owner until replacement accepts
            </p>
          </button>

          <button
            onClick={() => onChoice("keep")}
            className="w-full rounded-xl border border-slate-600 bg-slate-800 py-3 text-sm font-medium text-slate-300 transition-all hover:bg-slate-700"
          >
            Keep Current Tasks
            <p className="mt-0.5 text-xs font-normal text-slate-500">
              You will remain responsible for these tasks
            </p>
          </button>

          <button
            onClick={onCancel}
            className="text-sm text-slate-500 hover:text-slate-400"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export function AvailabilityControl({
  initialState,
  initialVersion,
}: AvailabilityControlProps) {
  const [version, setVersion] = useState(initialVersion);
  const [error, setError] = useState<string | null>(null);
  const [openTasks, setOpenTasks] = useState<Assignment[] | null>(null);
  const [pendingState, setPendingState] = useState<AvailabilityState | null>(null);
  const [optimisticState, setOptimisticState] = useOptimistic(initialState);
  const [isPending, startTransition] = useTransition();

  async function handleChange(newState: AvailabilityState, choice?: "keep" | "handover") {
    setError(null);

    startTransition(async () => {
      // Optimistic update
      setOptimisticState(newState);

      try {
        const res = await fetch("/api/staff/me/availability", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            state: newState,
            open_task_choice: choice,
            expected_version: version,
          }),
        });

        const json = await res.json();

        if (res.status === 409 && json.error?.code === "HAS_OPEN_TASKS") {
          // Roll back optimistic update, show modal
          setOptimisticState(initialState);
          setPendingState(newState);
          setOpenTasks(json.error.open_tasks ?? []);
          return;
        }

        if (!res.ok) {
          // Roll back on any other error
          setOptimisticState(initialState);
          setError(json.error?.message ?? "Failed to update availability");
          return;
        }

        // Success — update local version for next optimistic lock
        setVersion(json.data.capability_version);
      } catch {
        setOptimisticState(initialState);
        setError("Network error — please try again");
      }
    });
  }

  function handleModalChoice(choice: "keep" | "handover") {
    setOpenTasks(null);
    if (pendingState) {
      handleChange(pendingState, choice);
      setPendingState(null);
    }
  }

  const states: AvailabilityState[] = ["available", "busy", "off_duty"];

  return (
    <>
      {openTasks && (
        <OpenTaskModal
          tasks={openTasks}
          onChoice={handleModalChoice}
          onCancel={() => {
            setOpenTasks(null);
            setPendingState(null);
          }}
        />
      )}

      <div className="rounded-2xl border border-slate-700/50 bg-slate-800/50 p-5 backdrop-blur-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-300">
            My Availability
          </h3>
          {isPending && (
            <span className="text-xs text-slate-500">Saving…</span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {states.map((state) => {
            const config = STATE_CONFIG[state];
            const isActive = optimisticState === state;
            return (
              <button
                key={state}
                onClick={() => !isActive && handleChange(state)}
                disabled={isPending || isActive}
                className={`
                  relative rounded-xl border px-3 py-4 text-left transition-all duration-200
                  ${isActive
                    ? `${config.bg} ring-2 ring-offset-2 ring-offset-slate-900 ${
                        state === "available"
                          ? "ring-emerald-500"
                          : state === "busy"
                          ? "ring-amber-500"
                          : "ring-slate-500"
                      }`
                    : "border-slate-700 bg-slate-800/60 hover:border-slate-600 hover:bg-slate-700/60"
                  }
                  disabled:cursor-default
                `}
              >
                <span className={`block text-sm font-semibold ${isActive ? config.color : "text-slate-300"}`}>
                  {config.label}
                </span>
                <span className="mt-1 block text-xs text-slate-500 leading-tight">
                  {config.description}
                </span>
                {isActive && (
                  <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-current animate-pulse" />
                )}
              </button>
            );
          })}
        </div>

        {error && (
          <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            {error}
          </p>
        )}
      </div>
    </>
  );
}
