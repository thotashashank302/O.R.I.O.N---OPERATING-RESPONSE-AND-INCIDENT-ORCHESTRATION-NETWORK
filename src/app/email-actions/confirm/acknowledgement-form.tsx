"use client";

import { useState } from "react";

export function AcknowledgementForm({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [message, setMessage] = useState("Sign in as the assigned staff member before confirming.");

  async function acknowledge() {
    setState("submitting");
    setMessage("Checking your identity and the current assignment version…");
    const response = await fetch("/api/email-actions/acknowledge", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setState("error");
      setMessage(payload?.error?.message ?? "This action could not be completed.");
      return;
    }
    setState("done");
    setMessage("Assignment acknowledged. Open ORION to review the authorized task details.");
  }

  return (
    <div className="mt-8">
      <button
        type="button"
        onClick={() => void acknowledge()}
        disabled={state === "submitting" || state === "done" || token.length < 40}
        className="w-full rounded-md bg-cyan-300 px-5 py-3 font-semibold text-cyan-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:bg-cyan-950 disabled:text-cyan-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300 sm:w-auto"
      >
        {state === "submitting" ? "Confirming…" : state === "done" ? "Acknowledged" : "Acknowledge assignment"}
      </button>
      <p aria-live="polite" className={`mt-4 text-sm ${state === "error" ? "text-red-300" : state === "done" ? "text-emerald-300" : "text-slate-400"}`}>{message}</p>
    </div>
  );
}
