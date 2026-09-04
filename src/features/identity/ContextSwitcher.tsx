"use client";

import React, { useState, useEffect } from "react";
import { UserContextItem } from "@/contracts/identity";

interface ContextSwitcherProps {
  currentContext?: UserContextItem | null;
  onContextChange?: (context: UserContextItem) => void;
}

export function ContextSwitcher({
  currentContext,
  onContextChange,
}: ContextSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [contexts, setContexts] = useState<UserContextItem[]>([
    {
      institution_id: "demo-inst-1",
      institution_name: "ORION Institute of Technology",
      institution_code: "ORION-DEMO",
      membership_id: "demo-member-1",
      membership_status: "active",
      roles: [
        { role: "admin" },
        { role: "principal" },
        { role: "hod", department_name: "Computer Science" },
      ],
    },
    {
      institution_id: "demo-inst-2",
      institution_name: "North Campus Engineering",
      institution_code: "NCE-TECH",
      membership_id: "demo-member-2",
      membership_status: "active",
      roles: [
        { role: "cr", department_name: "Electronics", section: "A", seat_number: 1 },
      ],
    },
  ]);

  const [active, setActive] = useState<UserContextItem>(
    currentContext || contexts[0]
  );

  const handleSelect = (ctx: UserContextItem) => {
    setActive(ctx);
    setIsOpen(false);
    if (onContextChange) {
      onContextChange(ctx);
    }
  };

  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/70 text-xs text-slate-200 shadow-sm transition-all"
      >
        <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
        <div className="text-left">
          <div className="font-semibold text-white truncate max-w-[140px]">
            {active.institution_code}
          </div>
          <div className="text-[10px] text-slate-400 capitalize">
            {active.roles[0]?.role}
            {active.roles[0]?.seat_number ? ` (Seat ${active.roles[0]?.seat_number})` : ""}
          </div>
        </div>
        <svg
          className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 origin-top-right rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl p-2 z-50 text-xs">
          <div className="px-3 py-2 text-[10px] font-mono tracking-widest text-slate-400 uppercase border-b border-slate-800">
            SWITCH WORKSPACE CONTEXT
          </div>

          <div className="space-y-1 mt-1 max-h-60 overflow-y-auto">
            {contexts.map((ctx) => (
              <button
                key={ctx.membership_id}
                onClick={() => handleSelect(ctx)}
                className={`w-full text-left p-2.5 rounded-xl transition-all flex flex-col gap-1 ${
                  active.membership_id === ctx.membership_id
                    ? "bg-cyan-950/60 border border-cyan-700/60 text-white"
                    : "hover:bg-slate-800/60 text-slate-300"
                }`}
              >
                <div className="flex items-center justify-between font-medium">
                  <span>{ctx.institution_name}</span>
                  <span className="text-[10px] font-mono uppercase text-cyan-400">
                    {ctx.institution_code}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {ctx.roles.map((r, idx) => (
                    <span
                      key={idx}
                      className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 border border-slate-700"
                    >
                      {r.role}
                      {r.seat_number ? ` #${r.seat_number}` : ""}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
