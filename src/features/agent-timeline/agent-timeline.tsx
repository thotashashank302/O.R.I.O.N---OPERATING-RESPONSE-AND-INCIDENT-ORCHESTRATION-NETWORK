import type { TimelineEvent } from "./contracts";

const actionLabels: Record<string, string> = {
  commander_plan_created: "Commander created a response plan",
  specialist_assignment_created: "Specialist proposed and assigned an eligible responder",
  assignment_acknowledged: "Responder acknowledged the assignment",
  job_dead_escalated: "Automation stopped and escalated to a supervisor",
};

export function AgentTimeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return <p className="rounded-lg border border-slate-800 bg-slate-950/40 p-5 text-sm text-slate-400">No authorized activity is available yet.</p>;
  }
  return (
    <ol aria-label="Incident activity" className="space-y-0">
      {events.map((event, index) => (
        <li key={event.id} className="grid grid-cols-[1.25rem_1fr] gap-3">
          <div aria-hidden="true" className="flex flex-col items-center">
            <span className="mt-1.5 size-2 rounded-full bg-cyan-300" />
            {index < events.length - 1 ? <span className="my-1 w-px grow bg-slate-700" /> : null}
          </div>
          <div className="pb-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-medium text-slate-100">{actionLabels[event.action] ?? "ORION activity updated"}</p>
              <time className="text-xs text-slate-500" dateTime={event.createdAt}>
                {new Date(event.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}
              </time>
            </div>
            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">{event.actorType}</p>
            {typeof event.safePayload.carriedFromTaskId === "string" ? (
              <p className="mt-2 text-sm text-amber-200">Verified work was carried forward from the prior plan.</p>
            ) : null}
            {typeof event.safePayload.linkedIncidentId === "string" ? (
              <p className="mt-2 text-sm text-cyan-200">This activity is linked to another authorized case.</p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
