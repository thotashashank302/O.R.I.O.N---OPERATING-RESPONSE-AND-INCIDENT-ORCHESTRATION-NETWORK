"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Assignment } from "@/contracts/operations";
import { EvidenceForm } from "./EvidenceForm";

export function StaffEvidence({ assignment }: { assignment: Assignment }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  if (!assignment.task) return null;
  return <div className="mt-4">
    <button type="button" className="rounded-lg border border-cyan-300 bg-cyan-50 px-4 py-2 text-xs font-semibold text-cyan-700" onClick={() => setOpen(!open)} aria-expanded={open}>
      {open ? "Close evidence form" : "Submit Evidence"}
    </button>
    {open && <EvidenceForm taskId={assignment.task_id} assignmentId={assignment.id} assignmentVersion={assignment.version} task={assignment.task} incidentCategory={assignment.incident?.category ?? ""} onSuccess={() => { setOpen(false); router.refresh(); }} />}
  </div>;
}
