"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useActiveContext, orionContextHeaders } from "@/features/identity/use-active-context";
import type { UserContextItem } from "@/contracts/identity";

type Task = { id: string; goal: string; incidentId: string; evidenceVersion: number; dueAt: string | null };
type Evidence = { id: string; kind: string; result: { content?: string; note?: string }; imageUrl: string | null };
function Review({ task, context, onDecision }: { task: Task; context: UserContextItem; onDecision: () => void }) {
  const [evidence, setEvidence] = useState<Evidence[] | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const inspect = async () => {
    setPending(true); setError(null);
    try {
      const response = await fetch(`/api/tasks/${task.id}/evidence`, { headers: orionContextHeaders(context) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "Could not load evidence");
      setEvidence(body.data);
    } catch (error) { setError(error instanceof Error ? error.message : "Could not load evidence"); }
    finally { setPending(false); }
  };
  const decide = async (human_result: "confirmed" | "rejected") => {
    if (!reason.trim() || (human_result === "rejected" && reason.trim().length < 3)) { setError("Describe your inspection and decision."); return; }
    setPending(true); setError(null);
    try {
      const response = await fetch(`/api/tasks/${task.id}/verify`, { method: "POST", headers: { "Content-Type": "application/json", ...orionContextHeaders(context) },
        body: JSON.stringify({ evidence_version: task.evidenceVersion, human_result, rejection_reason: reason, trigger: "human" }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "Review could not be confirmed");
      onDecision();
    } catch (error) { setError(error instanceof Error ? error.message : "Review could not be confirmed"); }
    finally { setPending(false); }
  };
  return <article className="rounded-xl border border-stone-200 bg-white p-5 space-y-4">
    <h2 className="font-semibold">{task.goal}</h2>
    <p className="text-sm text-stone-600">Evidence version {task.evidenceVersion}. Confirm the physical result before accepting.</p>
    <Link href={`/incidents/${task.incidentId}`} className="underline">Open incident</Link>
    <div><button type="button" onClick={inspect} disabled={pending} className="rounded border px-3 py-2">{pending ? "Loading…" : "Inspect or refresh evidence"}</button></div>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {evidence && <><ul className="space-y-3">{evidence.map(row => <li key={row.id} className="rounded bg-stone-50 p-3">
      <strong>{row.kind.replaceAll("_", " ")}</strong><p className="whitespace-pre-wrap">{row.result?.content ?? row.result?.note}</p>
      {row.kind === "photo" && !row.imageUrl && <p role="alert" className="text-red-700">Photo ownership is unverified. Request fresh evidence before accepting.</p>}
      {row.imageUrl && <a href={row.imageUrl} target="_blank" rel="noreferrer" className="underline">View private photograph (link expires in one minute)</a>}
    </li>)}</ul>
    <label className="block">Inspection notes<textarea value={reason} maxLength={1000} onChange={event => setReason(event.target.value)} className="mt-1 block w-full rounded border p-2" /></label>
    <div className="flex gap-3"><button type="button" disabled={pending || !evidence.length || evidence.some(row => row.kind === "photo" && !row.imageUrl)} onClick={() => decide("confirmed")} className="rounded bg-stone-800 px-4 py-2 text-white disabled:opacity-50">Confirm repair</button>
    <button type="button" disabled={pending} onClick={() => decide("rejected")} className="rounded border border-red-300 px-4 py-2 text-red-700 disabled:opacity-50">Reject evidence</button></div></>}
  </article>;
}
export function VerificationDesk() {
  const { activeContext, loading } = useActiveContext();
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async (signal?: AbortSignal) => {
    if (!activeContext) return;
    try {
      const response = await fetch("/api/verification", { headers: orionContextHeaders(activeContext), signal });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "Could not load reviews");
      if (!signal?.aborted) { setTasks(body.data); setError(null); }
    } catch (error) { if (!signal?.aborted) setError(error instanceof Error ? error.message : "Could not load reviews"); }
  }, [activeContext]);
  useEffect(() => { const controller = new AbortController(); void Promise.resolve().then(() => { if (!controller.signal.aborted) return load(controller.signal); }); return () => controller.abort(); }, [load]);
  return <section className="mx-auto max-w-3xl space-y-5 p-6"><h1 className="text-2xl font-bold">Verification desk</h1>
    <p>Review tasks assigned to you, including incidents reported by someone else.</p>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    <button type="button" onClick={() => load()} className="rounded border px-3 py-2">Refresh reviews</button>
    {loading || !activeContext || tasks === null ? <p role="status">{!loading && !activeContext ? "Select an active campus membership." : "Loading reviews…"}</p>
      : tasks.length === 0 ? <p>No tasks currently await your review.</p>
      : tasks.map(task => <Review key={`${activeContext.membership_id}:${task.id}:${task.evidenceVersion}`} task={task} context={activeContext} onDecision={() => load()} />)}
  </section>;
}
